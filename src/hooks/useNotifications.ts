// src/hooks/useNotifications.ts
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Notification as NotificationData } from '../lib/db';

import { getStudentUUID } from '../lib/uuid';

const getStudentId = () => getStudentUUID(); // Use consistent UUID

export function useNotifications() {
  // Get unread notifications count
  const unreadCount = useLiveQuery(
    () => db.notifications
      .where('userId')
      .equals(getStudentId())
      .filter(n => !n.isRead) // Filter by isRead manually (boolean indexing in IndexedDB is tricky)
      .count(),
    []
  );

  // Get recent notifications
  const notifications = useLiveQuery(
    () => db.notifications
      .where('userId')
      .equals(getStudentId())
      .reverse()
      .sortBy('createdAt'),
    []
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
    const notification: NotificationData = {
      userId: getStudentId(),
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
    const unread = await db.notifications
      .where({ userId: getStudentId(), isRead: false })
      .toArray();
    
    await Promise.all(
      unread.map(n => n.id && db.notifications.update(n.id, { isRead: true }))
    );
  };

  const clearAll = async () => {
    await db.notifications
      .where('userId')
      .equals(getStudentId())
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
