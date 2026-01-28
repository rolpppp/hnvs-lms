import { Routes, Route, HashRouter, Link, useLocation } from 'react-router-dom';
import { Wifi, WifiOff, RefreshCw, BookOpen, CheckCircle, User, LayoutDashboard, Bell } from 'lucide-react';
import { useSync } from './hooks/useSync';
import { useNotifications } from './hooks/useNotifications';
import Dashboard from './pages/Dashboard';
import CourseDetail from './pages/CourseDetail';
import QuizPlayer from './pages/QuizPlayer';
import LessonViewer from './pages/LessonViewer';
import StudentProgress from './pages/StudentProgress';
import TeacherDashboard from './pages/teachers/TeacherDashboard'; // <--- IMPORT
import AssignmentManager from './pages/teachers/AssignmentManager';
import ContentUpload from './pages/teachers/ContentUpload';
import AnnouncementManager from './pages/teachers/AnnouncementManager';
import NotificationCenter from './pages/NotificationCenter';

function Layout({ children }: { children: React.ReactNode }) {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useSync();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  
  // Check if we are in Teacher Mode
  const isTeacherMode = location.pathname.includes('/teacher');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* HEADER */}
      <header className={`sticky top-0 z-50 text-white shadow-md transition-colors duration-300 ${isOnline ? 'bg-blue-900' : 'bg-yellow-600'}`}>
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          
          {/* Logo / Home Link */}
          <Link to="/" className="flex items-center gap-2">
            {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
            <span className="text-sm font-semibold tracking-wide">
              {isTeacherMode ? 'HNVS Instructor' : 'HNVS Student'}
            </span>
          </Link>

          <div className="flex items-center gap-3">
             {/* Role Switcher (For Prototype Demo Only) */}
             <Link 
               to={isTeacherMode ? "/" : "/teacher"} 
               className="text-[10px] bg-white/20 px-2 py-1 rounded border border-white/30 hover:bg-white/30"
             >
               {isTeacherMode ? 'Switch to Student' : 'Switch to Teacher'}
             </Link>

             {/* Notification Bell for Students */}
             {!isTeacherMode && (
               <Link
                 to="/notifications"
                 className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
               >
                 <Bell size={18} />
                 {unreadCount > 0 && (
                   <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                     {unreadCount}
                   </span>
                 )}
               </Link>
             )}

             {/* Sync Badge (Only show for students usually, but kept for demo) */}
             {!isTeacherMode && pendingCount > 0 && (
               <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                 {pendingCount}
               </span>
             )}
            
            <button 
              onClick={triggerSync}
              disabled={!isOnline || isSyncing}
              className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <main className="pb-20">
        {children}
      </main>

      {/* BOTTOM NAV - Only show for STUDENTS */}
      {!isTeacherMode && !location.pathname.includes('/quiz') && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-40 max-w-md mx-auto">
          <Link to="/" className="flex flex-col items-center gap-1 text-blue-900">
            <BookOpen size={24} />
            <span className="text-[10px] font-medium">Courses</span>
          </Link>
          <Link to="/progress" className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600">
            <CheckCircle size={24} />
            <span className="text-[10px] font-medium">Progress</span>
          </Link>
          <button className="flex flex-col items-center gap-1 text-slate-400">
            <User size={24} />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </nav>
      )}

      {/* BOTTOM NAV - Teacher Version (Optional) */}
      {isTeacherMode && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-40 max-w-md mx-auto">
          <Link to="/teacher" className="flex flex-col items-center gap-1 text-blue-900">
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-medium">Overview</span>
          </Link>
          <button className="flex flex-col items-center gap-1 text-slate-400">
            <User size={24} />
            <span className="text-[10px] font-medium">Students</span>
          </button>
        </nav>
      )}
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/course/:courseId" element={<CourseDetail />} />
          <Route path="/lesson/:lessonId" element={<LessonViewer />} />
          <Route path="/progress" element={<StudentProgress />} />
          <Route path="/quiz/:quizId" element={<QuizPlayer />} />
          <Route path="/notifications" element={<NotificationCenter />} />
          
          {/* TEACHER ROUTES */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/assignments" element={<AssignmentManager />} />
          <Route path="/teacher/upload" element={<ContentUpload />} />
          <Route path="/teacher/announcements" element={<AnnouncementManager />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
