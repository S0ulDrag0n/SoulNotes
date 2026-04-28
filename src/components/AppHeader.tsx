'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ModeTab } from './ModeTab';
import { SettingsModal } from './SettingsModal';
import { useState } from 'react';
import { isDesktopMode } from '@/utils/platform';

const MODES = [
  { 
    id: 'transcribe', 
    label: 'Transcribe', 
    icon: '🎤', 
    path: '/'
  },
  { 
    id: 'conversation', 
    label: 'Conversation', 
    icon: '💬', 
    path: '/conversation'
  },
  { 
    id: 'flashcards', 
    label: 'Flashcards', 
    icon: '📚', 
    path: '/flashcards'
  },
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    icon: '📊', 
    path: '/dashboard'
  },
] as const;

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const isDesktop = isDesktopMode();

  const handleModeClick = (path: string) => {
    router.push(path);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-[#15120d]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
              SoulNotes
            </span>
          </div>

          {/* Mode Tabs */}
          <nav className="flex gap-1">
            {MODES.map((mode) => (
              <ModeTab
                key={mode.id}
                label={mode.label}
                icon={mode.icon}
                isActive={pathname === mode.path}
                onClick={() => handleModeClick(mode.path)}
              />
            ))}
          </nav>

          {/* Right side buttons */}
          <div className="flex items-center gap-2">
            {/* Settings button - only in desktop mode */}
            {isDesktop && (
              <button
                onClick={() => setShowSettingsModal(true)}
                className="rounded-lg border border-[#d7c7a7] px-3 py-1.5 text-sm font-medium text-[#6b5a3f] transition hover:bg-[#f0e6d6] dark:border-[#3b2f1d] dark:text-[#c8b7a0] dark:hover:bg-[#2a2218]"
                title="Settings"
              >
                ⚙️
              </button>
            )}
          </div>
        </div>
      </header>

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  );
}