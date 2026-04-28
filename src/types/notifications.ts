export type NotificationType = 'xp' | 'achievement' | 'level-up' | 'streak' | 'debug';

export type DebugCategory = 'websocket' | 'audio' | 'connection' | 'general';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon?: string;
  duration?: number;
  createdAt: number;
}

export interface XPNotification extends Omit<Notification, 'type'> {
  type: 'xp';
  amount: number;
}

export interface AchievementNotification extends Omit<Notification, 'type'> {
  type: 'achievement';
  achievementId: string;
  achievementName: string;
}

export interface LevelUpNotification extends Omit<Notification, 'type'> {
  type: 'level-up';
  newLevel: number;
  levelName: string;
}

export interface StreakNotification extends Omit<Notification, 'type'> {
  type: 'streak';
  streakDays: number;
}

export interface DebugNotification extends Omit<Notification, 'type'> {
  type: 'debug';
  category: DebugCategory;
}