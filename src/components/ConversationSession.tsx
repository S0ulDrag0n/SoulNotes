// src/components/ConversationSession.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { SCENARIO_CONFIGS } from '@/types/conversation';
import type { ConversationSession, ConversationMessage } from '@/types/conversation';
import { SelectableText } from '@/components/SelectableText';

interface ConversationSessionProps {
  session: ConversationSession;
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  onStartRecording: (micDevice?: string) => Promise<void>;
  onStopRecording: () => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onEndSession: () => void;
  onSaveVocabulary: (word: string, translation: string, context: string) => Promise<void>;
  onAddToFlashcards?: () => void;
}

export function ConversationSession({
  session,
  isRecording,
  isProcessing,
  isSpeaking,
  sourceLanguage,
  targetLanguage,
  onStartRecording,
  onStopRecording,
  onSendMessage,
  onEndSession,
  onSaveVocabulary,
  onAddToFlashcards,
}: ConversationSessionProps) {
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages]);

  const handleSendText = () => {
    if (textInput.trim()) {
      onSendMessage(textInput);
      setTextInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const scenarioConfig = SCENARIO_CONFIGS[session.scenario];

  return (
    <div className="flex flex-col gap-4">
      {/* Session Info */}
      <div className="flex items-center justify-between rounded-xl border border-[#d7c7a7] bg-white/70 p-4 dark:border-[#3b2f1d] dark:bg-[#1b1711]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{scenarioConfig?.icon || '✨'}</span>
          <div>
            <p className="font-medium text-[#1f1c16] dark:text-[#f3e9d8]">
              {scenarioConfig?.name || session.scenario.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
            <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
              {session.language.toUpperCase()} • {session.difficulty}
            </p>
          </div>
        </div>
        <button
          onClick={onEndSession}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          End Session
        </button>
      </div>

      {/* Messages */}
      <div className="h-[400px] overflow-y-auto rounded-2xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-[#15120d]/85">
        {session.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-[#8b7a5a] dark:text-[#6b5a3f]">
              Start speaking or type a message to begin the conversation
            </p>
          </div>
        ) : (
          <SelectableText
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            source="conversation"
            onAddToFlashcards={onAddToFlashcards}
          >
            <div className="space-y-4">
              {session.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onSaveVocabulary={onSaveVocabulary}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </SelectableText>
        )}
        
        {isProcessing && (
          <div className="mt-4 flex items-center gap-2 text-[#8b7a5a] dark:text-[#6b5a3f]">
            <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            <span className="text-sm">AI is thinking...</span>
          </div>
        )}
        
        {isSpeaking && (
          <div className="mt-4 flex items-center gap-2 text-[#8b7a5a] dark:text-[#6b5a3f]">
            <span className="text-sm">🔊 Speaking...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex gap-3">
        <button
          onClick={() => isRecording ? onStopRecording() : onStartRecording()}
          disabled={isProcessing || isSpeaking}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
            isRecording
              ? 'animate-pulse bg-red-500 text-white'
              : 'bg-[#1f1c16] text-[#f6e9cc] hover:bg-[#342d22] dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]'
          } disabled:cursor-not-allowed disabled:opacity-50`}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          {isRecording ? '⏹️' : '🎤'}
        </button>
        
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isProcessing || isSpeaking}
            className="flex-1 rounded-xl border border-[#d7c7a7] bg-white px-4 py-2 text-sm text-[#2a241b] focus:outline-none focus:ring-2 focus:ring-[#f3b34b] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#3b2f1d] dark:bg-[#1b1711] dark:text-[#f6f1e6]"
          />
          <button
            onClick={handleSendText}
            disabled={!textInput.trim() || isProcessing || isSpeaking}
            className="rounded-xl bg-[#1f1c16] px-6 py-2 text-sm font-semibold text-[#f6e9cc] transition hover:bg-[#342d22] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#f6e9cc] dark:text-[#1f1c16] dark:hover:bg-[#e9d3a7]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ 
  message, 
  onSaveVocabulary 
}: { 
  message: ConversationMessage;
  onSaveVocabulary: (word: string, translation: string, context: string) => Promise<void>;
}) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-[#1f1c16] text-[#f6e9cc] dark:bg-[#f6e9cc] dark:text-[#1f1c16]'
          : 'bg-[#efe0c3] text-[#1f1c16] dark:bg-[#2a2218] dark:text-[#f0e6d5]'
      }`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
        
        {/* Corrections */}
        {message.corrections && message.corrections.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-black/10 pt-2 dark:border-white/10">
            {message.corrections.map((correction, i) => (
              <div key={i} className="text-xs">
                <span className="line-through opacity-60">{correction.original}</span>
                <span className="mx-1">→</span>
                <span className="font-medium text-green-700 dark:text-green-400">
                  {correction.corrected}
                </span>
                <p className="mt-0.5 opacity-70">{correction.explanation}</p>
              </div>
            ))}
          </div>
        )}
        
        {/* Vocabulary */}
        {message.vocabulary && message.vocabulary.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-black/10 pt-2 dark:border-white/10">
            {message.vocabulary.map((vocab, i) => (
              <button
                key={i}
                onClick={() => onSaveVocabulary(vocab.word, vocab.translation, vocab.context)}
                className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 transition hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
              >
                {vocab.word} - {vocab.translation} +
              </button>
            ))}
          </div>
        )}
        
        <p className="mt-1 text-xs opacity-50">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}