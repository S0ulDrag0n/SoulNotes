'use client';

import { useNotifications } from '@/contexts/NotificationContext';
import type { NotificationType } from '@/types/notifications';

const typeStyles: Record<NotificationType, { bg: string; border: string; iconBg: string }> = {
  xp: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    iconBg: 'bg-amber-100 dark:bg-amber-800/50',
  },
  achievement: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-300 dark:border-purple-700',
    iconBg: 'bg-purple-100 dark:bg-purple-800/50',
  },
  'level-up': {
    bg: 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20',
    border: 'border-amber-400 dark:border-amber-600',
    iconBg: 'bg-gradient-to-br from-amber-200 to-orange-200 dark:from-amber-700 dark:to-orange-700',
  },
  streak: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-300 dark:border-orange-700',
    iconBg: 'bg-orange-100 dark:bg-orange-800/50',
  },
  debug: {
    bg: 'bg-slate-50 dark:bg-slate-900/20',
    border: 'border-slate-300 dark:border-slate-700',
    iconBg: 'bg-slate-100 dark:bg-slate-800/50',
  },
};

export function NotificationToast() {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => {
        const styles = typeStyles[notification.type];
        
        return (
          <div
            key={notification.id}
            className={`
              animate-slide-in-right flex items-start gap-3 rounded-lg border p-4 shadow-lg
              ${styles.bg} ${styles.border}
            `}
            onClick={() => removeNotification(notification.id)}
          >
            {notification.icon && (
              <div className={`flex-shrink-0 rounded-full p-2 ${styles.iconBg}`}>
                <span className="text-xl">{notification.icon}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#1f1c16] dark:text-[#f3e9d8]">
                {notification.title}
              </p>
              <p className="text-sm text-[#5c4d39] dark:text-[#c8b7a0]">
                {notification.message}
              </p>
            </div>
            <button
              className="flex-shrink-0 text-[#8b7a5a] hover:text-[#1f1c16] dark:text-[#6b5a3f] dark:hover:text-[#f3e9d8] transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}