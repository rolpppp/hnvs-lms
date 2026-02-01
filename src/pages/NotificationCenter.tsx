// src/pages/NotificationCenter.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, Trash2, Award, AlertCircle, Calendar, Cloud } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'grade': return <Award className="text-green-600" size={20} />;
      case 'announcement': return <Bell className="text-orange-600" size={20} />;
      case 'deadline': return <Calendar className="text-blue-600" size={20} />;
      case 'sync': return <Cloud className="text-slate-600" size={20} />;
      default: return <AlertCircle className="text-slate-600" size={20} />;
    }
  };

  // Capture now once per render cycle (or use a periodic update if needed, but for simple display this is enough to satisfy 'pure')
  const [now] = useState(() => Date.now());

  const formatTime = (timestamp: number) => {
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-blue-900 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Notifications</h1>
              <p className="text-blue-100 text-sm">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs bg-white/20 px-3 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-1"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs bg-white/20 px-3 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Bell className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-400 text-lg font-medium">No notifications yet</p>
            <p className="text-slate-400 text-sm mt-1">We'll notify you about grades and announcements</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => notification.id && !notification.isRead && markAsRead(notification.id)}
              className={`bg-white rounded-xl p-4 shadow-sm border-2 transition-all cursor-pointer hover:shadow-md ${notification.isRead
                ? 'border-slate-200 opacity-75'
                : 'border-blue-200 bg-blue-50/30'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${notification.isRead ? 'bg-slate-100' : 'bg-white'}`}>
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">
                      {notification.title}
                    </h3>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm mt-1">
                    {notification.message}
                  </p>
                  {!notification.isRead && (
                    <span className="inline-block mt-2 text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      NEW
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
