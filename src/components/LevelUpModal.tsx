'use client';

import { useEffect, useState } from 'react';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: number;
  levelName: string;
}

function Confetti() {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
  const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 5 + Math.random() * 10,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {confettiPieces.map((piece) => (
        <div
          key={piece.id}
          className="confetti"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }}
        />
      ))}
    </div>
  );
}

export function LevelUpModal({ isOpen, onClose, level, levelName }: LevelUpModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="animate-celebrate mx-4 max-w-md rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 p-8 text-center shadow-2xl dark:from-amber-900/50 dark:to-orange-900/50">
          <div className="mb-4 text-6xl">🎉</div>
          <h2 className="mb-2 text-3xl font-bold text-[#1f1c16] dark:text-[#f3e9d8]">
            Level Up!
          </h2>
          <div className="mb-4 text-5xl font-bold text-amber-600 dark:text-amber-400">
            {level}
          </div>
          <p className="mb-6 text-lg text-[#5c4d39] dark:text-[#c8b7a0]">
            You are now a <span className="font-semibold text-amber-700 dark:text-amber-300">{levelName}</span>!
          </p>
          <div className="flex justify-center gap-2 mb-4">
            <span className="text-2xl">⭐</span>
            <span className="text-2xl">🏆</span>
            <span className="text-2xl">⭐</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-amber-500 px-6 py-2 font-medium text-white transition hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700"
          >
            Continue
          </button>
        </div>
      </div>
    </>
  );
}