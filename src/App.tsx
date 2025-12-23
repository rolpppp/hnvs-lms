import { Routes, Route, HashRouter } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import CourseDetail from "./pages/CourseDetail";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useSync } from "./hooks/useSync";

// We create a Layout component to keep the Header/Nav persistent
function Layout({ children }: { children: React.ReactNode }) {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useSync();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* GLOBAL HEADER */}
      <header
        className={`sticky top-0 z-50 text-white shadow-md transition-colors duration-300 ${
          isOnline ? "bg-blue-900" : "bg-yellow-600"
        }`}
      >
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
            <span className="text-sm font-semibold tracking-wide">
              {isOnline ? "HNVS Online" : "Offline Mode"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {pendingCount} Queued
              </span>
            )}
            <button
              onClick={triggerSync}
              disabled={!isOnline || isSyncing}
              className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={18}
                className={isSyncing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main>{children}</main>
    </div>
  );
}

function App() {
  return (
    // We use HashRouter because it's easier for PWAs hosted on static file servers
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/course/:courseId" element={<CourseDetail />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
