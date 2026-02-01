// src/pages/teachers/AnnouncementManager.tsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Bell, AlertCircle, Send, Clock } from 'lucide-react';
import { db, type Announcement } from '../../lib/db';
import { supabase } from '../../lib/supabase';

const TEACHER_ID = 'teacher-1'; // Mock teacher ID

interface AnnouncementManagerProps {
  courseId?: string;
}

export default function AnnouncementManager({ courseId }: AnnouncementManagerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    isUrgent: false,
    courseId: courseId || '',
  });

  const loadAnnouncements = useCallback(async () => {
    let allAnnouncements = await db.announcements.toArray();

    // Filter by courseId if provided
    if (courseId) {
      allAnnouncements = allAnnouncements.filter(a => a.courseId === courseId);
    }

    setAnnouncements(allAnnouncements.sort((a, b) => b.createdAt - a.createdAt));
  }, [courseId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newAnnouncement: Announcement = {
      id: crypto.randomUUID(), // Use real UUID
      teacherId: TEACHER_ID,
      title: formData.title,
      content: formData.content,
      isUrgent: formData.isUrgent,
      courseId: courseId || formData.courseId || undefined,
      // eslint-disable-next-line react-hooks/purity
      createdAt: Date.now(),
      syncStatus: 'synced', // Assume synced if online, else pending
    };

    // 1. Save to Supabase (if we have a courseId)
    // Note: We use the supabase client directly here for immediate feedback
    if (newAnnouncement.courseId) {
      try {
        // Need to get current user ID really, but for now we rely on RLS or the mock TEACHER_ID
        // Actually, let's just insert.
        const { error } = await supabase.from('announcements').insert({
          id: newAnnouncement.id,
          course_id: newAnnouncement.courseId,
          teacher_id: (await supabase.auth.getUser()).data.user?.id,
          title: newAnnouncement.title,
          content: newAnnouncement.content,
          is_urgent: newAnnouncement.isUrgent,
          created_at: new Date(newAnnouncement.createdAt).toISOString()
        });

        if (error) {
          console.error("Failed to sync announcement:", error);
          newAnnouncement.syncStatus = 'pending'; // Fallback to pending
        }
      } catch (err) {
        console.error("Offline or error:", err);
        newAnnouncement.syncStatus = 'pending';
      }
    }

    await db.announcements.add(newAnnouncement);

    // If urgent and browser supports notifications, request permission
    if (formData.isUrgent && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        sendPushNotification(newAnnouncement);
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          sendPushNotification(newAnnouncement);
        }
      }
    }

    // Reset form
    setFormData({
      title: '',
      content: '',
      isUrgent: false,
      courseId: courseId || '',
    });
    setShowCreateForm(false);
    loadAnnouncements();
  };

  const sendPushNotification = (announcement: Announcement) => {
    try {
      new Notification(announcement.isUrgent ? '🚨 URGENT: ' + announcement.title : announcement.title, {
        body: announcement.content,
        icon: '/src/assets/logo.png',
        badge: '/src/assets/logo.png',
        tag: announcement.id,
        requireInteraction: announcement.isUrgent,
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-slate-50 min-h-full pb-24">
      {/* Header - Only show if separate page, not embedded */}
      {!courseId && (
        <div className="bg-blue-900 text-white p-6 mb-6">
          <div className="max-w-4xl mx-auto">
            <Link
              to="/teacher"
              className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft size={18} /> Back to Dashboard
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold">Announcements</h1>
            <p className="text-blue-100 text-sm">Send urgent notifications to students</p>
          </div>
        </div>
      )}

      <div className={`max-w-4xl mx-auto ${courseId ? '' : 'p-4'} space-y-6`}>
        {/* Info Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <Bell className="text-yellow-600 mt-0.5 flex-shrink-0" size={20} />
          <div className="text-sm text-yellow-900">
            <p className="font-medium">Urgent Announcements</p>
            <p className="text-yellow-700 mt-1">
              Urgent announcements will trigger push notifications as soon as students have internet connection.
            </p>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="w-full bg-white border-2 border-dashed border-slate-300 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-slate-600 hover:text-blue-600 font-medium"
        >
          <Plus size={20} />
          Create New Announcement
        </button>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">New Announcement</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Class Suspension Notice"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Message
                </label>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter announcement details..."
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  id="urgent"
                  checked={formData.isUrgent}
                  onChange={(e) => setFormData({ ...formData, isUrgent: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="urgent" className="flex-1">
                  <p className="font-medium text-slate-900">Mark as Urgent</p>
                  <p className="text-xs text-slate-500">
                    Will trigger push notification on students' devices
                  </p>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-medium hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  Send Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Announcement List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Recent Announcements</h2>
          {announcements.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-slate-400">
              <p>No announcements yet</p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-5 hover:shadow-md transition-shadow ${announcement.isUrgent
                  ? 'border-red-200 bg-red-50/30'
                  : 'border-slate-200'
                  }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {announcement.isUrgent && (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                          <AlertCircle size={14} />
                          URGENT
                        </span>
                      )}
                      <h3 className="font-bold text-slate-900 text-lg">
                        {announcement.title}
                      </h3>
                    </div>
                    <p className="text-slate-600 text-sm mt-2">{announcement.content}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  <Clock size={14} />
                  <span>{formatDate(announcement.createdAt)}</span>
                  {announcement.courseId && (
                    <>
                      <span>•</span>
                      <span>Course: {announcement.courseId}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
