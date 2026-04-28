// src/hooks/useTTS.ts

import { useState, useCallback, useRef } from 'react';
import { DEFAULT_REALTIME_CONFIG, DEFAULT_TTS_CONFIG } from '@/lib/constants';

interface UseTTSReturn {
  isGenerating: boolean;
  isPlaying: boolean;
  error: string | null;
  generateAudio: (text: string, language: string) => Promise<ArrayBuffer | null>;
  playAudio: (audioData: ArrayBuffer) => void;
  stopAudio: () => void;
}

const SPEACHES_BASE_URL = process.env.NEXT_PUBLIC_SPEACHES_BASE_URL || DEFAULT_REALTIME_CONFIG.baseUrl;
const SPEACHES_TTS_MODEL = process.env.NEXT_PUBLIC_SPEACHES_TTS_MODEL || DEFAULT_TTS_CONFIG.model;

export function useTTS(): UseTTSReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const generateAudio = useCallback(async (text: string, language: string): Promise<ArrayBuffer | null> => {
    if (!text.trim()) return null;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Map language code to voice
      const voiceMap: Record<string, string> = {
        'en': 'alloy',
        'es': 'alloy',
        'fr': 'alloy',
        'de': 'alloy',
        'it': 'alloy',
        'pt': 'alloy',
        'ja': 'alloy',
        'ko': 'alloy',
        'zh': 'alloy',
        'ar': 'alloy',
      };
      
      const voice = voiceMap[language] || 'alloy';
      
      // Call Speaches TTS API
      const response = await fetch(`${SPEACHES_BASE_URL}/v1/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: SPEACHES_TTS_MODEL,
          input: text,
          voice: voice,
          response_format: 'mp3',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`TTS API error: ${response.statusText}`);
      }
      
      const audioBuffer = await response.arrayBuffer();
      return audioBuffer;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const playAudio = useCallback((audioData: ArrayBuffer) => {
    const audioContext = getAudioContext();
    
    // Stop any currently playing audio
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    
    // Decode and play
    audioContext.decodeAudioData(audioData)
      .then((audioBuffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        
        source.onended = () => {
          setIsPlaying(false);
          sourceRef.current = null;
        };
        
        sourceRef.current = source;
        setIsPlaying(true);
        source.start(0);
      })
      .catch((err) => {
        setError(`Failed to decode audio: ${err.message}`);
        setIsPlaying(false);
      });
  }, [getAudioContext]);

  const stopAudio = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  return {
    isGenerating,
    isPlaying,
    error,
    generateAudio,
    playAudio,
    stopAudio,
  };
}