// Hook for realtime transcription using WebSocket

import { useState, useRef, useCallback, useEffect } from 'react';
import { floatTo16BitPCM, downsampleBuffer, int16ToBase64 } from '@/utils/audio';
import { generateMessageId } from '@/utils/text';
import { REALTIME_AUDIO, REALTIME_SESSION_INSTRUCTIONS, SILENCE_RESET, WEBSOCKET_CONFIG } from '@/lib/constants';
import { useNotifications } from '@/contexts/NotificationContext';
import type { DebugCategory } from '@/types/notifications';
import { getVadService, downsample24to16, upsample16to24 } from '@/lib/vad-service';
import { isHallucination } from '@/lib/hallucination-filter';

// ---------------------------------------------------------------------
// AudioWorklet URL — resolves to the pre-compiled JS file in /public
// ---------------------------------------------------------------------
const AUDIO_WORKLET_URL = '/worklets/audio-processor.worklet.js';

export interface TranscriptMessage {
  id: string;
  text: string;
  timestamp: Date;
}

export interface UseRealtimeTranscriptionOptions {
  baseUrl: string;
  model: string;
  language: string;
  intent?: string;
  /** Use external audio source (e.g., from Tauri) instead of Web Audio API */
  useExternalAudio?: boolean;
  /** Enable VAD (Voice Activity Detection) to filter out silence */
  useVAD?: boolean;
}

export interface UseRealtimeTranscriptionReturn {
  isRealtime: boolean;
  isTranscribing: boolean;
  transcript: string;
  transcriptMessages: TranscriptMessage[];
  startTranscription: () => Promise<void>;
  stopTranscription: () => void;
  /** Send audio data from external source (only when useExternalAudio is true) */
  sendAudioData: (pcm16: Int16Array) => void;
  /** Clear all transcript messages */
  clearTranscript: () => void;
  /** Pre-warm the WebSocket connection so startTranscription can reuse it */
  warmConnection: () => void;
}

// ---------------------------------------------------------------------
// Build WebSocket URL for realtime transcription
// ---------------------------------------------------------------------
function buildRealtimeUrl(baseUrl: string, model: string, language: string, intent: string): string {
  const url = new URL('/v1/realtime', baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${url}?intent=${encodeURIComponent(intent)}&model=${encodeURIComponent(model)}&language=${encodeURIComponent(language)}`;
}

export function useRealtimeTranscription(
  options: UseRealtimeTranscriptionOptions
): UseRealtimeTranscriptionReturn {
  const { baseUrl, model, language, intent = 'transcription', useExternalAudio = false, useVAD = true } = options;

  const [isRealtime, setIsRealtime] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [transcriptMessages, setTranscriptMessages] = useState<TranscriptMessage[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null); // separate ref for worklet-specific cleanup
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const currentMessageRef = useRef<TranscriptMessage | null>(null);

  // VAD state
  const vadInitializedRef = useRef<boolean>(false);
  const vadSpeechStateRef = useRef<boolean>(false);

  // Keepalive and health monitoring refs
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const healthCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioMonitorIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const lastAudioSentTimeRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef<number>(0);
  const isReconnectingRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoResetRef = useRef<boolean>(false); // Flag for auto-reset vs error reconnect
  const sessionStartTimeRef = useRef<number>(0);

  // Batch streaming transcript via requestAnimationFrame (Change B)
  const streamingTextRef = useRef<string>('');
  const pendingUpdateRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);

  // Pre-warm WebSocket connection (Change C)
  const preWarmedWsRef = useRef<WebSocket | null>(null);

  // Refs for functions called from callbacks (avoids circular dependencies)
  const attemptReconnectRef = useRef<() => Promise<void>>(null!);
  const startHealthCheckRef = useRef<() => void>(null!);
  const startAudioMonitorRef = useRef<() => void>(null!);
  const scheduleAutoResetRef = useRef<() => void>(null!);

  // Get notification context for debug messages
  const { notifyDebug } = useNotifications();

  // ---------------------------------------------------------------------
  // Debug notification helper
  // ---------------------------------------------------------------------
  const debugNotify = useCallback((title: string, message: string, category: DebugCategory = 'general') => {
    notifyDebug(title, message, category);
  }, [notifyDebug]);

  // ---------------------------------------------------------------------
  // Flush pending streaming update (used by Change B — rAF batching)
  // ---------------------------------------------------------------------
  const flushStreamingUpdate = useCallback(() => {
    if (!pendingUpdateRef.current) return;
    const streamingText = streamingTextRef.current;
    setTranscriptMessages((prev) => {
      if (currentMessageRef.current) {
        return prev.map((msg) =>
          msg.id === currentMessageRef.current?.id
            ? { ...msg, text: streamingText }
            : msg
        );
      }
      return prev;
    });
    pendingUpdateRef.current = false;
  }, []);

  // ---------------------------------------------------------------------
  // Append transcript (final or streaming, with rAF batching)
  // ---------------------------------------------------------------------
  const appendTranscript = useCallback((text: string, isFinal: boolean = true) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Filter hallucinations on final transcripts
    if (isFinal && isHallucination(trimmed)) {
      console.warn('[RealtimeTranscription] Filtered hallucination:', trimmed.substring(0, 100));
      return;
    }

    if (isFinal) {
      // Flush any pending streaming update before adding final message
      if (pendingUpdateRef.current) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current!);
          rafIdRef.current = null;
        }
        flushStreamingUpdate();
      }

      const newMessage: TranscriptMessage = {
        id: generateMessageId(),
        text: trimmed,
        timestamp: new Date(),
      };
      setTranscriptMessages((prev) => [...prev, newMessage]);
      setTranscript((prev) => (prev ? `${prev} ${trimmed}` : trimmed));
      currentMessageRef.current = null;
      streamingTextRef.current = '';
    } else {
      // Streaming: batch updates via requestAnimationFrame
      streamingTextRef.current = trimmed;

      // Update or create current streaming message ref
      if (!currentMessageRef.current) {
        currentMessageRef.current = {
          id: `streaming-${Date.now()}`,
          text: trimmed,
          timestamp: new Date(),
        };
        // Add placeholder immediately so the list renders the new entry
        setTranscriptMessages((prev) => [...prev, currentMessageRef.current!]);
      }

      // Schedule a rAF flush if one isn't already pending
      if (!pendingUpdateRef.current) {
        pendingUpdateRef.current = true;
        rafIdRef.current = requestAnimationFrame(() => {
          flushStreamingUpdate();
        });
      }
    }
  }, [flushStreamingUpdate]);

  // ---------------------------------------------------------------------
  // Parse realtime WebSocket messages
  // ---------------------------------------------------------------------
  const parseRealtimeMessage = useCallback((message: string) => {
    // Update last message time for health monitoring
    lastMessageTimeRef.current = Date.now();

    try {
      const data = JSON.parse(message);

      // Handle streaming transcripts (partial/interim results)
      if (data?.type === 'conversation.item.input_audio_transcription.delta') {
        const delta = data.delta ?? data.text ?? data.content ?? data?.data?.text;
        if (typeof delta === 'string' && delta.trim()) {
          appendTranscript(delta, false);
        }
        return;
      }

      if (typeof data === 'string') {
        appendTranscript(data, true);
        return;
      }

      if (data?.type === 'conversation.item.input_audio_transcription.completed') {
        const transcription =
          data.transcript ??
          data.item?.transcript ??
          data.item?.content?.[0]?.transcript ??
          data.item?.payload?.transcriptions?.[0]?.text;
        if (typeof transcription === 'string') {
          appendTranscript(transcription, true);
          return;
        }
      }

      const text =
        data.text ??
        data.transcript ??
        data.output_text ??
        data.delta ??
        data.content ??
        data?.data?.text;
      if (typeof text === 'string') {
        appendTranscript(text, true);
      }
    } catch {
      appendTranscript(message, true);
    }
  }, [appendTranscript]);

  // ---------------------------------------------------------------------
  // Send session update to WebSocket
  // ---------------------------------------------------------------------
  const sendSessionUpdate = useCallback((ws: WebSocket, languageVal: string) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    let extraInstructions = '';
    if (languageVal === 'zh') {
      extraInstructions = ' Respond in Traditional Chinese.';
    }

    ws.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          instructions: `${REALTIME_SESSION_INSTRUCTIONS}${extraInstructions}`,
          input_audio_transcription: { model },
        },
      })
    );
  }, [model]);

  // ---------------------------------------------------------------------
  // Clear all intervals and timeouts
  // ---------------------------------------------------------------------
  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    if (audioMonitorIntervalRef.current) {
      clearInterval(audioMonitorIntervalRef.current);
      audioMonitorIntervalRef.current = null;
    }
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
      autoResetTimeoutRef.current = null;
    }
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------
  // Ensure AudioContext is running
  // ---------------------------------------------------------------------
  const ensureAudioContextRunning = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return false;
    
    if (ctx.state === 'suspended') {
      ctx.resume().catch((err) => {
        console.error('[RealtimeTranscription] Failed to resume AudioContext:', err);
      });
      return false;
    }
    return ctx.state === 'running';
  }, []);

  // ---------------------------------------------------------------------
  // Stop transcription (defined early for use in other callbacks)
  // ---------------------------------------------------------------------
  const stopTranscription = useCallback(() => {
    setIsRealtime(false);
    setIsTranscribing(false);
    isReconnectingRef.current = false;
    isAutoResetRef.current = false;

    // Cancel any pending rAF for streaming updates
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingUpdateRef.current = false;
    streamingTextRef.current = '';

    // Clear intervals and timeouts
    clearTimers();

    // Reset VAD state (full reset when stopping capture)
    if (vadInitializedRef.current) {
      try {
        const vadService = getVadService();
        vadService.resetFull();
      } catch {
        // Ignore VAD cleanup errors
      }
    }
    vadSpeechStateRef.current = false;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      } catch {
        // Ignore cleanup errors
      }
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, [clearTimers]);

  // ---------------------------------------------------------------------
  // Start keepalive ping interval
  // Note: OpenAI Realtime API doesn't support custom 'ping' messages.
  // WebSocket has built-in ping/pong at the protocol level.
  // We rely on: 1) continuous audio stream, 2) health check for stale connections
  // ---------------------------------------------------------------------
  const startKeepalive = useCallback(() => {
    // Clear any existing interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    // We don't send application-level pings since the API doesn't support them.
    // Instead, we use the health check interval to monitor connection state.
    // The WebSocket protocol itself handles keepalive at the TCP level.
  }, []);

  // ---------------------------------------------------------------------
  // Start audio context monitor (checks AudioContext state independently)
  // ---------------------------------------------------------------------
  const startAudioMonitor = useCallback(() => {
    // Clear any existing interval
    if (audioMonitorIntervalRef.current) {
      clearInterval(audioMonitorIntervalRef.current);
    }

    audioMonitorIntervalRef.current = setInterval(() => {
      const ctx = audioContextRef.current;
      
      // Check AudioContext state
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch((err) => {
            console.error('[RealtimeTranscription] Failed to resume AudioContext:', err);
          });
        }
      }
      
      // Check if audio events have stopped coming through
      const now = Date.now();
      const audioEventElapsed = now - lastAudioSentTimeRef.current;
      
      // If no audio events for 5 seconds while transcribing, something is wrong
      // Try to recover by ensuring AudioContext is running
      if (lastAudioSentTimeRef.current > 0 && audioEventElapsed > 5000 && isReconnectingRef.current === false) {
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }
    }, 3000); // Check every 3 seconds
  }, []);

  // ---------------------------------------------------------------------
  // Start connection health monitoring
  // ---------------------------------------------------------------------
  const startHealthCheck = useCallback(() => {
    // Clear any existing interval
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    healthCheckIntervalRef.current = setInterval(() => {
      const ws = wsRef.current;
      
      // Only check for stale connection if WebSocket is in a bad state
      // During silence, the server won't send messages, so we can't use
      // "no messages" as an indicator of a dead connection
      if (!ws) {
        isReconnectingRef.current = true;
        attemptReconnectRef.current();
        return;
      }
      
      if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        isReconnectingRef.current = true;
        attemptReconnectRef.current();
        return;
      }
      
      // Don't auto-reconnect on silence - let the audio monitor handle AudioContext issues
      // Only reconnect if WebSocket is actually broken
    }, 10000); // Check every 10 seconds
  }, []);

  // ---------------------------------------------------------------------
  // Schedule auto-reset with silence-gating (Change A)
  // Only auto-reset during detected silence, with a safety valve for
  // max session duration.
  // ---------------------------------------------------------------------
  const scheduleAutoReset = useCallback(() => {
    // Clear any existing timers
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
      autoResetTimeoutRef.current = null;
    }
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }

    // Record session start time
    sessionStartTimeRef.current = Date.now();

    // Safety valve: force a reset after maxSessionMs even during speech
    autoResetTimeoutRef.current = setTimeout(() => {
      if (!isReconnectingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('[RealtimeTranscription] Auto-reset: max session time reached (safety valve)');
        // Commit and clear any pending audio buffer
        try {
          wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
        } catch { /* Ignore errors */ }
        
        // Close WebSocket but preserve MediaStream
        wsRef.current.close();
        wsRef.current = null;

        // Clean up audio processing but preserve MediaStream
        if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
        }
        if (workletNodeRef.current) {
          workletNodeRef.current.port.onmessage = null;
          workletNodeRef.current.disconnect();
          workletNodeRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        isAutoResetRef.current = true;
        isReconnectingRef.current = true;
        reconnectAttemptsRef.current = 0;
        attemptReconnectRef.current();
      }
    }, SILENCE_RESET.maxSessionMs);

    // Periodic silence check: reset when silence ≥ minSilenceMs
    silenceCheckIntervalRef.current = setInterval(() => {
      if (isReconnectingRef.current) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const now = Date.now();
      const sessionMs = now - sessionStartTimeRef.current;

      // Use audio send activity (lastAudioSentTimeRef) instead of server messages
      // (lastMessageTimeRef). The server only sends messages when it has a
      // transcript to return, so "no server message" ≠ silence. If we're
      // actively sending audio, we should NOT reset.
      const audioSilenceMs = now - (lastAudioSentTimeRef.current || sessionStartTimeRef.current);

      // Don't consider reset if:
      // 1. We're still sending audio (audioSilenceMs < minSilenceMs means
      //    audio chunks are flowing, so we're not truly silent)
      // 2. The session just started (need a grace period for the server to
      //    respond — at least one minSilenceMs cycle after connect)
      if (audioSilenceMs < SILENCE_RESET.minSilenceMs) return;
      if (sessionMs < SILENCE_RESET.minSilenceMs * 2) return;

      const messageSilenceMs = now - lastMessageTimeRef.current;
      console.log(`[RealtimeTranscription] Auto-reset: audio silence detected (${audioSilenceMs}ms), no server messages for ${messageSilenceMs}ms, session duration ${sessionMs}ms`);
      // Commit and clear any pending audio buffer
      try {
        wsRef.current!.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        wsRef.current!.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
      } catch { /* Ignore errors */ }
      
      // Close WebSocket but preserve MediaStream
      wsRef.current!.close();
      wsRef.current = null;

      // Clean up audio processing but preserve MediaStream
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Clear timers (including this interval and the safety valve)
      if (autoResetTimeoutRef.current) {
        clearTimeout(autoResetTimeoutRef.current);
        autoResetTimeoutRef.current = null;
      }
      if (silenceCheckIntervalRef.current) {
        clearInterval(silenceCheckIntervalRef.current);
        silenceCheckIntervalRef.current = null;
      }

      isAutoResetRef.current = true;
      isReconnectingRef.current = true;
      reconnectAttemptsRef.current = 0;
      attemptReconnectRef.current();
    }, 5000); // Check every 5 seconds
  }, []);

  // ---------------------------------------------------------------------
  // Setup realtime transcription (with optional existing MediaStream)
  // ---------------------------------------------------------------------
  const setupRealtimeTranscription = useCallback(async (existingStream?: MediaStream) => {
    // Use existing stream if provided and active, otherwise get new one
    let stream: MediaStream;
    if (existingStream && existingStream.active) {
      stream = existingStream;
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: REALTIME_AUDIO.sampleRate,
        },
      });
    }

    const wsUrl = buildRealtimeUrl(baseUrl, model, language, intent);
    const ws = new WebSocket(wsUrl);

    wsRef.current = ws;
    mediaStreamRef.current = stream;

    // Reset last message time
    lastMessageTimeRef.current = Date.now();

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        parseRealtimeMessage(event.data);
      }
    };

    ws.onerror = (event) => {
      console.error('[RealtimeTranscription] WebSocket error:', event);
      ws.close();
    };

    ws.onclose = (event) => {
      console.log('[RealtimeTranscription] WebSocket closed:', event.code, event.reason);
    };

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        resolve();
      };
      ws.onclose = () => reject(new Error('Realtime WebSocket closed'));
      ws.onerror = () => reject(new Error('Realtime WebSocket error'));
    });

    sendSessionUpdate(ws, language);

    // Start keepalive
    startKeepalive();

    const audioContext = new AudioContext({ sampleRate: REALTIME_AUDIO.sampleRate });
    const source = audioContext.createMediaStreamSource(stream);

    // ----------------------------------------------------------------
    // Audio capture: try AudioWorklet first, fall back to ScriptProcessorNode
    // ----------------------------------------------------------------
    const useWorklet = typeof audioContext.audioWorklet !== 'undefined';

    const sendPcm16 = (pcm16: Int16Array) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const base64 = int16ToBase64(pcm16);
      wsRef.current.send(
        JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }),
      );
    };

    if (useWorklet) {
      // --- AudioWorklet path (low latency, off-main-thread) ---
      try {
        await audioContext.audioWorklet.addModule(AUDIO_WORKLET_URL);
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

        workletNode.port.onmessage = (event: MessageEvent) => {
          // Track that we're receiving audio events
          lastAudioSentTimeRef.current = Date.now();

          if (event.data?.type === 'audio-data' && event.data.pcm16) {
            // Worklet already converts to Int16 at the native sample rate.
            // If AudioContext.sampleRate differs from target, downsample here.
            let pcm16: Int16Array = event.data.pcm16;
            if (audioContext.sampleRate !== REALTIME_AUDIO.sampleRate) {
              // Downsample: Int16 → Float32 → downsample → Float32 → Int16
              const float32 = new Float32Array(pcm16.length);
              for (let i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
              }
              const resampled = downsampleBuffer(float32, audioContext.sampleRate, REALTIME_AUDIO.sampleRate);
              pcm16 = floatTo16BitPCM(resampled);
            }
            sendPcm16(pcm16);
          }
        };

        source.connect(workletNode);
        workletNode.connect(audioContext.destination);

        audioContextRef.current = audioContext;
        processorRef.current = workletNode;
        workletNodeRef.current = workletNode;
        setIsRealtime(true);

        console.log('[RealtimeTranscription] Using AudioWorklet for audio capture');
        return; // Successfully set up worklet — done
      } catch (err) {
        console.warn('[RealtimeTranscription] AudioWorklet setup failed, falling back to ScriptProcessorNode:', err);
        // Clean up any partial worklet state before falling through
        if (workletNodeRef.current) {
          workletNodeRef.current.port.onmessage = null;
          workletNodeRef.current.disconnect();
          workletNodeRef.current = null;
        }
      }
    }

    // --- ScriptProcessorNode fallback (deprecated, main-thread) ---
    const processor = audioContext.createScriptProcessor(REALTIME_AUDIO.processorBufferSize, 1, 1);

    processor.onaudioprocess = (event) => {
      // Track that we're receiving audio events
      lastAudioSentTimeRef.current = Date.now();

      // Check AudioContext state
      if (!ensureAudioContextRunning()) {
        return;
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      const inputData = event.inputBuffer.getChannelData(0);
      const resampled = downsampleBuffer(inputData, audioContext.sampleRate, REALTIME_AUDIO.sampleRate);
      const pcm16 = floatTo16BitPCM(resampled);
      sendPcm16(pcm16);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    processorRef.current = processor;
    setIsRealtime(true);

    console.log('[RealtimeTranscription] Using ScriptProcessorNode fallback for audio capture');
  }, [baseUrl, model, language, intent, parseRealtimeMessage, sendSessionUpdate, startKeepalive, ensureAudioContextRunning]);

  // ---------------------------------------------------------------------
  // Attempt to reconnect with exponential backoff
  // ---------------------------------------------------------------------
  const attemptReconnect = useCallback(async () => {
    // Don't reconnect if not transcribing or already reconnecting
    if (!isReconnectingRef.current) {
      return;
    }

    // Check max retries
    if (reconnectAttemptsRef.current >= WEBSOCKET_CONFIG.maxRetries) {
      stopTranscription();
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = WEBSOCKET_CONFIG.retryDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
    
    const isAutoReset = isAutoResetRef.current;

    // Wait with exponential backoff (no delay for auto-reset)
    if (!isAutoReset || reconnectAttemptsRef.current > 1) {
      await new Promise<void>((resolve) => {
        reconnectTimeoutRef.current = setTimeout(resolve, delay);
      });
    }

    // Check if still transcribing after delay
    if (!isReconnectingRef.current) {
      return;
    }

    // Clean up existing connection (but preserve MediaStream for auto-reset)
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // For auto-reset, try to reuse existing MediaStream
      const existingStream = isAutoReset ? mediaStreamRef.current : undefined;
      await setupRealtimeTranscription(existingStream ?? undefined);
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;
      isAutoResetRef.current = false;
      
      // Restart all timers after successful reconnection
      startHealthCheckRef.current();
      startAudioMonitorRef.current();
      scheduleAutoResetRef.current();
    } catch (err) {
      // Try again recursively using ref to avoid circular dependency
      attemptReconnectRef.current();
    }
  }, [clearTimers, setupRealtimeTranscription, stopTranscription]);

  // Keep refs updated for callbacks
  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

  useEffect(() => {
    startHealthCheckRef.current = startHealthCheck;
  }, [startHealthCheck]);

  useEffect(() => {
    startAudioMonitorRef.current = startAudioMonitor;
  }, [startAudioMonitor]);

  useEffect(() => {
    scheduleAutoResetRef.current = scheduleAutoReset;
  }, [scheduleAutoReset]);

  // ---------------------------------------------------------------------
  // Send audio data from external source (Tauri)
  // ---------------------------------------------------------------------
  const sendAudioData = useCallback(async (pcm16: Int16Array) => {
    console.error('[RealtimeTranscription] sendAudioData called, useVAD:', useVAD, 'samples:', pcm16.length);
    
    if (!wsRef.current) {
      console.error('[RealtimeTranscription] sendAudioData called but WebSocket ref is null');
      return;
    }
    
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.error(`[RealtimeTranscription] sendAudioData called but WebSocket not open (state: ${wsRef.current.readyState})`);
      return;
    }
    
    // VAD filtering (desktop/Tauri path only)
    if (useVAD && vadInitializedRef.current) {
      // VAD is ready — filter audio through Silero
      try {
        const vadService = getVadService();
        
        // Downsample from 24kHz to 16kHz for VAD
        const audio16k = downsample24to16(pcm16);
        
        // Process through VAD
        const vadResult = await vadService.processInt16(audio16k);
        
        // If speech just started, send pre-buffered audio first
        if (vadResult.speechStart) {
          const preBuffer = vadService.getAndClearPreBuffer();
          if (preBuffer.length > 0) {
            // Pre-buffer is at 16kHz (VAD sample rate) — upsample to 24kHz for Whisper
            const preBuffer24k = upsample16to24(preBuffer);
            const preBufferBase64 = int16ToBase64(preBuffer24k);
            if (wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({ type: 'input_audio_buffer.append', audio: preBufferBase64 })
              );
            }
          }
        }
        
        // Send audio if speech is detected OR this is the final chunk where speech ends.
        // On speechEnd, isSpeech is false but we still need to send this last chunk.
        if (!vadResult.isSpeech && !vadResult.speechStart && !vadResult.speechEnd) {
          // Don't send silence to transcription
          return;
        }
        
        // Track that we're sending audio
        lastAudioSentTimeRef.current = Date.now();
        
        // Convert Int16Array to base64 and send
        const base64 = int16ToBase64(pcm16);
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 })
          );
        }
        
        // When speech ends: reset debounce counters and commit audio buffer
        // so the server finalizes the utterance. Do NOT reset model state —
        // the Silero model needs its hidden state to stay warm for the next
        // speech segment.
        if (vadResult.speechEnd) {
          vadService.reset();
          // Commit the audio buffer so the server processes the utterance,
          // then clear any residual audio to prevent Whisper hallucinations
          // (repeating garbage like "press again" on silence/noise).
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
            wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          }
        }
      } catch (error) {
        console.error('[RealtimeTranscription] VAD inference error, passing audio through:', error);
        // On VAD error, pass audio through (fallback behavior)
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          lastAudioSentTimeRef.current = Date.now();
          const base64 = int16ToBase64(pcm16);
          wsRef.current.send(
            JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 })
          );
        }
      }
    } else {
      // VAD not ready or disabled — send all audio directly (passthrough)
      lastAudioSentTimeRef.current = Date.now();
      const base64 = int16ToBase64(pcm16);
      wsRef.current.send(
        JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 })
      );
    }
  }, [useVAD]);

  // ---------------------------------------------------------------------
  // Pre-warm WebSocket connection (Change C)
  // Opens a WebSocket and sends session.update so the connection is
  // ready when the user clicks start. Does NOT start audio capture.
  // ---------------------------------------------------------------------
  const warmConnection = useCallback(() => {
    // If we already have a pre-warmed connection that's still open, skip
    if (preWarmedWsRef.current && preWarmedWsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = buildRealtimeUrl(baseUrl, model, language, intent);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      sendSessionUpdate(ws, language);
    };

    ws.onmessage = () => {
      // Discard any messages received during pre-warm
    };

    ws.onerror = () => {
      // Silently discard — startTranscription will create a fresh one
      if (preWarmedWsRef.current === ws) {
        preWarmedWsRef.current = null;
      }
    };

    ws.onclose = () => {
      if (preWarmedWsRef.current === ws) {
        preWarmedWsRef.current = null;
      }
    };

    preWarmedWsRef.current = ws;
  }, [baseUrl, model, language, intent, sendSessionUpdate]);

  // ---------------------------------------------------------------------
  // Start transcription
  // ---------------------------------------------------------------------
  const startTranscription = useCallback(async () => {
    try {
      setTranscript('');
      setTranscriptMessages([]);
      setIsTranscribing(true);
      setIsRealtime(false);
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;
      isAutoResetRef.current = false;
      lastAudioSentTimeRef.current = 0; // Reset audio sent time
      
      // Only set up Web Audio API if not using external audio source
      if (!useExternalAudio) {
        await setupRealtimeTranscription();
      } else {
        // For external audio, set up WebSocket — reuse pre-warmed connection if available
        let ws: WebSocket;

        if (preWarmedWsRef.current && preWarmedWsRef.current.readyState === WebSocket.OPEN) {
          // Reuse pre-warmed connection
          ws = preWarmedWsRef.current;
          preWarmedWsRef.current = null;
        } else {
          // Clean up stale pre-warmed connection if any
          if (preWarmedWsRef.current) {
            preWarmedWsRef.current.close();
            preWarmedWsRef.current = null;
          }

          ws = new WebSocket(buildRealtimeUrl(baseUrl, model, language, intent));

          await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onclose = () => reject(new Error('Realtime WebSocket closed'));
            ws.onerror = () => reject(new Error('Realtime WebSocket error'));
          });

          sendSessionUpdate(ws, language);
        }

        wsRef.current = ws;

        // Reset last message time
        lastMessageTimeRef.current = Date.now();

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            parseRealtimeMessage(event.data);
          }
        };

        ws.onerror = (event) => {
          console.error('[RealtimeTranscription] WebSocket error:', event);
          ws.close();
        };

        ws.onclose = (event) => {
          console.log('[RealtimeTranscription] WebSocket closed:', event.code, event.reason);
        };

        startKeepalive();
        setIsRealtime(true);

        // Start loading VAD model in background (don't await — audio passes through until ready)
        if (useVAD) {
          console.error('[RealtimeTranscription] Starting VAD model initialization...');
          const vadService = getVadService();
          vadService.initialize()
            .then(() => {
              vadInitializedRef.current = true;
              console.error('[RealtimeTranscription] VAD service initialized successfully');
            })
            .catch((err) => {
              console.error('[RealtimeTranscription] VAD initialization failed, audio will pass through without VAD:', err);
              vadInitializedRef.current = false;
            });
        }
      }
      
      // Start health check after successful connection
      startHealthCheck();
      
      // Start audio context monitor (only for web audio)
      if (!useExternalAudio) {
        startAudioMonitor();
      }
      
      // Schedule auto-reset to release server GPU memory
      scheduleAutoReset();
    } catch (err) {
      console.error('Error starting transcription:', err);
      throw err;
    }
  }, [useExternalAudio, setupRealtimeTranscription, startHealthCheck, startAudioMonitor, scheduleAutoReset, baseUrl, model, language, intent, parseRealtimeMessage, sendSessionUpdate, startKeepalive]);

  // ---------------------------------------------------------------------
  // Handle visibility change (tab focus/blur)
  // ---------------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTranscribing) {
        ensureAudioContextRunning();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTranscribing, ensureAudioContextRunning]);

  // ---------------------------------------------------------------------
  // Clear transcript
  // ---------------------------------------------------------------------
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setTranscriptMessages([]);
    currentMessageRef.current = null;
    streamingTextRef.current = '';
    pendingUpdateRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTranscription();
      // Clean up pre-warmed connection if it was never used
      if (preWarmedWsRef.current) {
        preWarmedWsRef.current.close();
        preWarmedWsRef.current = null;
      }
      // Cancel pending rAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [stopTranscription]);

  return {
    isRealtime,
    isTranscribing,
    transcript,
    transcriptMessages,
    startTranscription,
    stopTranscription,
    sendAudioData,
    clearTranscript,
    warmConnection,
  };
}