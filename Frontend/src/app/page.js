"use client";

import { useState, useEffect } from 'react';
import Navbar from '../components/navbar';
import Footer from '../components/footer';
import Chat from '../components/Chat';
import Sidebar from '../components/Sidebar';
import AuthPage from '../components/authpage';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeChatId, setActiveChatId] = useState(null);

  useEffect(() => {
    setActiveChatId(null);
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4 rounded-full border border-cyan-500/30 bg-slate-900/70 px-8 py-6 shadow-[0_20px_50px_rgba(8,145,178,0.18)] backdrop-blur-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-500/30 border-t-cyan-400 border-r-sky-400"></div>
          <p className="text-sm tracking-[0.32em] text-slate-300">LOADING DOCUMIND</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),transparent_26%),#020817] text-slate-100">
      <Navbar onToggleSidebar={() => setShowSidebar((open) => !open)} sidebarOpen={showSidebar} />

      <main className="px-3 pb-8 pt-24 sm:px-4 lg:px-6">
        <div
          className={`mx-auto flex h-[calc(100vh-7.5rem)] max-w-[1600px] items-stretch gap-3 transition-all duration-300 ${showSidebar ? 'lg:gap-4' : 'lg:gap-0'}`}
        >
          <Sidebar
            isOpen={showSidebar}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
          />
          <div className="flex min-w-0 flex-1 justify-center">
            <Chat activeChatId={activeChatId} setActiveChatId={setActiveChatId} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
