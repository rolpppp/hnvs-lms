// src/hooks/useNotifications.ts
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Notification as NotificationData } from '../lib/db';
import { useAuth } from '../features/auth/AuthProvider';

export function useNotifications() {
  const { user } = useAuth();
  
  // Get unread notifications count
  const unreadCount = useLiveQuery(
    () => {
      if (!user?.id) return Promise.resolve(0);
      return db.notifications
        .where('userId')
        .equals(user.id)
        .filter(n => !n.isRead)
        .count();
    },
    [user?.id]
  );

  // Get recent notifications
  const notifications = useLiveQuery<NotificationData[]>(
    () => {
      if (!user?.id) return Promise.resolve([]);
      return db.notifications
        .where('userId')
        .equals(user.id)
        .reverse()
        .sortBy('createdAt');
    },
    [user?.id]
  );

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const createNotification = async (
    type: 'grade' | 'announcement' | 'deadline' | 'sync',
    title: string,
    message: string,
    relatedId?: string
  ) => {
    if (!user?.id) return;
    
    const notification: NotificationData = {
      userId: user.id,
      type,
      title,
      message,
      isRead: false,
      createdAt: Date.now(),
      relatedId,
    };

    await db.notifications.add(notification);

    // Send browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/src/assets/logo.png',
        badge: '/src/assets/logo.png',
        tag: `${type}-${relatedId || Date.now()}`,
      });
    }
  };

  const markAsRead = async (id: number) => {
    await db.notifications.update(id, { isRead: true });
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    const unread = await db.notifications
      .where({ userId: user.id, isRead: false })
      .toArray();
    
    await Promise.all(
      unread.map(n => n.id && db.notifications.update(n.id, { isRead: true }))
    );
  };

  const clearAll = async () => {
    if (!user?.id) return;
    await db.notifications
      .where('userId')
      .equals(user.id)
      .delete();
  };

  return {
    notifications: notifications || [],
    unreadCount: unreadCount || 0,
    createNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}

// Hook to auto-create grade notifications when quiz is synced
export function useGradeNotifications() {
  const { createNotification } = useNotifications();

  const notifyGradePosted = async (quizId: string, score: number, total: number) => {
    const percentage = Math.round((score / total) * 100);
    const passed = percentage >= 75;

    await createNotification(
      'grade',
      passed ? '🎉 Quiz Graded!' : 'Quiz Results Available',
      `You scored ${score}/${total} (${percentage}%) on your recent quiz.`,
      quizId
    );
  };

  return { notifyGradePosted };
}
