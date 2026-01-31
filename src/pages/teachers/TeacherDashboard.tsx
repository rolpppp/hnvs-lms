// src/pages/teacher/TeacherDashboard.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  CloudRain,
  AlertTriangle,
  Search,
  CheckCircle,
  Calendar,
  Download,
  Bell,
  BookOpen
} from 'lucide-react';

// --- MOCK DATA FOR PROTOTYPE ---
// In a real app, this joins 'profiles' and 'quiz_submissions' tables
const MOCK_STUDENTS = [
  { id: 1, name: 'Juan Dela Cruz', course: 'Automotive NCII', lastSynced: '10 mins ago', status: 'online', risk: 'low', grade: 88 },
  { id: 2, name: 'Maria Santos', course: 'Cookery NCII', lastSynced: '2 days ago', status: 'offline', risk: 'medium', grade: 92 },
  { id: 3, name: 'Pedro Penduko', course: 'Electrical Install', lastSynced: '5 days ago', status: 'offline', risk: 'high', grade: 75 },
  { id: 4, name: 'Ana Reyes', course: 'Automotive NCII', lastSynced: '1 hour ago', status: 'online', risk: 'low', grade: 85 },
];

export default function TeacherDashboard() {
  const [filter, setFilter] = useState('');

  const exportToCSV = () => {
    // Generate CSV content
    const headers = ['Student Name', 'Course', 'Last Synced', 'Status', 'Grade'];
    const rows = MOCK_STUDENTS.map(student => [
      student.name,
      student.course,
      student.lastSynced,
      student.status,
      student.grade.toString()
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `student-scores-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-24 p-4 max-w-4xl mx-auto">

      {/* 1. HEADER SECTION */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Instructor Dashboard</h1>
        <p className="text-slate-500 text-sm">Welcome back, Sir J. Dela Cruz</p>
      </div>

      {/* 2. STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Active Students"
          value="42"
          icon={<Users className="text-blue-600" size={20} />}
          bg="bg-blue-50"
        />
        <StatCard
          label="Pending Syncs"
          value="8"
          sub="Waiting for students"
          icon={<CloudRain className="text-yellow-600" size={20} />}
          bg="bg-yellow-50"
        />
        <StatCard
          label="High Risk"
          value="3"
          sub="No sync > 3 days"
          icon={<AlertTriangle className="text-red-600" size={20} />}
          bg="bg-red-50"
        />
        <StatCard
          label="Avg. Grade"
          value="85%"
          icon={<CheckCircle className="text-green-600" size={20} />}
          bg="bg-green-50"
        />
      </div>

      {/* 3. STUDENT TRACKER TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center gap-2 flex-wrap">
          <h2 className="font-bold text-slate-800">Student Progress</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Download size={16} />
              Export CSV
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search student..."
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table Header (Hidden on small mobile, visible on desktop/tablet) */}
        <div className="grid grid-cols-12 gap-4 p-3 bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
          <div className="col-span-5 md:col-span-4">STUDENT</div>
          <div className="col-span-3 hidden md:block">COURSE</div>
          <div className="col-span-4 md:col-span-3 text-right md:text-left">LAST SYNCED</div>
          <div className="col-span-3 md:col-span-2 text-center">STATUS</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-slate-100">
          {MOCK_STUDENTS.filter(s => s.name.toLowerCase().includes(filter.toLowerCase())).map((student) => (
            <div key={student.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors">

              {/* Name Column */}
              <div className="col-span-5 md:col-span-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${student.risk === 'high' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                  {student.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-slate-900 text-sm">{student.name}</div>
                  <div className="text-xs text-slate-500 md:hidden">{student.course}</div>
                </div>
              </div>

              {/* Course Column (Desktop) */}
              <div className="col-span-3 hidden md:block text-sm text-slate-600">
                {student.course}
              </div>

              {/* Last Synced Column */}
              <div className="col-span-4 md:col-span-3 text-right md:text-left">
                <div className={`text-sm font-medium ${student.risk === 'high' ? 'text-red-600' :
                  student.risk === 'medium' ? 'text-yellow-600' : 'text-slate-600'
                  }`}>
                  {student.lastSynced}
                </div>
                {student.risk === 'high' && <span className="text-[10px] text-red-500 block">Needs Follow-up</span>}
              </div>

              {/* Status Column */}
              <div className="col-span-3 md:col-span-2 flex justify-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${student.status === 'online'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                  <div className={`w-2 h-2 rounded-full ${student.status === 'online' ? 'bg-green-500' : 'bg-slate-400'}`} />
                  {student.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* 4. CONTENT UPLOAD CTA */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/teacher/courses"
          className="bg-blue-900 rounded-xl p-6 text-white shadow-lg hover:bg-blue-800 transition-colors block"
        >
          <div>
            <h3 className="font-bold text-lg">Manage Courses</h3>
            <p className="text-blue-200 text-sm max-w-xs mt-1">
              Create courses and upload materials.
            </p>
          </div>
          <div className="mt-4 inline-flex bg-white text-blue-900 px-4 py-3 rounded-lg font-bold text-sm items-center gap-2">
            <BookOpen size={18} />
            View Courses
          </div>
        </Link>

        <Link
          to="/teacher/assignments"
          className="bg-green-600 rounded-xl p-6 text-white shadow-lg hover:bg-green-700 transition-colors block"
        >
          <div>
            <h3 className="font-bold text-lg">Manage Assignments</h3>
            <p className="text-green-100 text-sm max-w-xs mt-1">
              Set sync deadlines for offline students.
            </p>
          </div>
          <div className="mt-4 inline-flex bg-white text-green-600 px-4 py-3 rounded-lg font-bold text-sm items-center gap-2">
            <Calendar size={18} />
            Open Manager
          </div>
        </Link>

        <Link
          to="/teacher/announcements"
          className="bg-orange-600 rounded-xl p-6 text-white shadow-lg hover:bg-orange-700 transition-colors block"
        >
          <div>
            <h3 className="font-bold text-lg">Send Announcements</h3>
            <p className="text-orange-100 text-sm max-w-xs mt-1">
              Push urgent notifications to students.
            </p>
          </div>
          <div className="mt-4 inline-flex bg-white text-orange-600 px-4 py-3 rounded-lg font-bold text-sm items-center gap-2">
            <Bell size={18} />
            Create
          </div>
        </Link>
      </div>

    </div>
  );
}

// Sub-component for simple stats
function StatCard({ label, value, icon, bg, sub }: any) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${bg}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}