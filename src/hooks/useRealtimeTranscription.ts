// Hook for realtime transcription using WebSocket

import { useState, useRef, useCallback, useEffect } from 'react';
import { floatTo16BitPCM, downsampleBuffer, int16ToBase64 } from '@/utils/audio';
import { generateMessageId } from '@/utils/text';
import { REALTIME_AUDIO, REALTIME_SESSION_INSTRUCTIONS, WEBSOCKET_CONFIG } from '@/lib/constants';
import { useNotifications } from '@/contexts/NotificationContext';
import type { DebugCategory } from '@/types/notifications';
import { getVadService, downsample24to16, upsample16to24 } from '@/lib/vad-service';
import { isHallucination } from '@/lib/hallucination-filter';

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
  const processorRef = useRef<ScriptProcessorNode | null>(null);
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
  const lastMessageTimeRef = useRef<number>(0);
  const lastAudioSentTimeRef = useRef<number>(0);
  const reconnectAttemptsRef = useRef<number>(0);
  const isReconnectingRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoResetRef = useRef<boolean>(false); // Flag for auto-reset vs error reconnect
  
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
  // Append transcript (final or streaming)
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
      const newMessage: TranscriptMessage = {
        id: generateMessageId(),
        text: trimmed,
        timestamp: new Date(),
      };
      setTranscriptMessages((prev) => [...prev, newMessage]);
      setTranscript((prev) => (prev ? `${prev} ${trimmed}` : trimmed));
      currentMessageRef.current = null;
    } else {
      // Update or create current streaming message
      if (currentMessageRef.current) {
        currentMessageRef.current = {
          ...currentMessageRef.current,
          text: trimmed,
        };
        setTranscriptMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMessageRef.current?.id
              ? { ...msg, text: trimmed }
              : msg
          )
        );
      } else {
        currentMessageRef.current = {
          id: `streaming-${Date.now()}`,
          text: trimmed,
          timestamp: new Date(),
        };
        setTranscriptMessages((prev) => [...prev, currentMessageRef.current!]);
      }
    }
  }, []);

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
  // Schedule auto-reset to release server GPU memory
  // ---------------------------------------------------------------------
  const scheduleAutoReset = useCallback(() => {
    // Clear any existing timeout
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
    }

    autoResetTimeoutRef.current = setTimeout(() => {
      if (!isReconnectingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        // Commit and clear any pending audio buffer
        if (wsRef.current) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
            wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          } catch {
            // Ignore errors
          }
        }
        
        // Close WebSocket but preserve MediaStream
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        
        // Clean up audio processing but preserve MediaStream
        if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        // Set flag to indicate this is an auto-reset (not an error)
        isAutoResetRef.current = true;
        isReconnectingRef.current = true;
        reconnectAttemptsRef.current = 0;
        
        // Trigger reconnect
        attemptReconnectRef.current();
      }
    }, WEBSOCKET_CONFIG.autoResetInterval);
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
      const base64 = int16ToBase64(pcm16);
      wsRef.current.send(
        JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 })
      );
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    processorRef.current = processor;
    setIsRealtime(true);
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
        // For external audio, just set up the WebSocket connection
        const wsUrl = buildRealtimeUrl(baseUrl, model, language, intent);
        const ws = new WebSocket(wsUrl);

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

        await new Promise<void>((resolve, reject) => {
          ws.onopen = () => {
            resolve();
          };
          ws.onclose = () => reject(new Error('Realtime WebSocket closed'));
          ws.onerror = () => reject(new Error('Realtime WebSocket error'));
        });

        sendSessionUpdate(ws, language);
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
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTranscription();
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
  };
}