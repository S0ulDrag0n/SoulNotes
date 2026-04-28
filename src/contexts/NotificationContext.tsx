'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Notification, NotificationType, DebugCategory } from '@/types/notifications';

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  notifyXP: (amount: number, message?: string) => string;
  notifyAchievement: (achievementId: string, achievementName: string, icon: string) => string;
  notifyLevelUp: (newLevel: number, levelName: string) => string;
  notifyStreak: (streakDays: number) => string;
  notifyDebug: (title: string, message: string, category?: DebugCategory) => string;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  xp: 2000,
  achievement: 4000,
  'level-up': 5000,
  streak: 3000,
  debug: 5000,
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      createdAt: Date.now(),
      duration: notification.duration ?? DEFAULT_DURATIONS[notification.type],
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const notifyXP = useCallback((amount: number, message?: string) => {
    return addNotification({
      type: 'xp',
      title: `+${amount} XP`,
      message: message ?? 'Experience gained!',
      icon: '⭐',
    });
  }, [addNotification]);

  const notifyAchievement = useCallback((achievementId: string, achievementName: string, icon: string) => {
    return addNotification({
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: achievementName,
      icon,
      duration: 5000,
    });
  }, [addNotification]);

  const notifyLevelUp = useCallback((newLevel: number, levelName: string) => {
    return addNotification({
      type: 'level-up',
      title: `Level ${newLevel}!`,
      message: `You are now a ${levelName}!`,
      icon: '🎉',
      duration: 5000,
    });
  }, [addNotification]);

  const notifyStreak = useCallback((streakDays: number) => {
    return addNotification({
      type: 'streak',
      title: `${streakDays} Day Streak! 🔥`,
      message: 'Keep up the great work!',
      icon: '🔥',
    });
  }, [addNotification]);

  const notifyDebug = useCallback((title: string, message: string, _category: DebugCategory = 'general') => {
    // Only show debug notifications in development mode
    if (process.env.NODE_ENV !== 'development') {
      // Also allow on localhost for testing
      if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
        return '';
      }
    }

    return addNotification({
      type: 'debug',
      title: `🔧 ${title}`,
      message,
      icon: '🔧',
      duration: 5000,
    });
  }, [addNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAll,
        notifyXP,
        notifyAchievement,
        notifyLevelUp,
        notifyStreak,
        notifyDebug,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}