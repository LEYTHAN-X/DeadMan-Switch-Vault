import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Lock, 
  UploadCloud, 
  Users, 
  Mail, 
  Clock, 
  Activity, 
  FileText, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Menu, 
  X,
  CheckCircle2,
  AlertTriangle,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate live countdown to user's nextCheckInAt
  useEffect(() => {
    if (!user?.nextCheckInAt) return;

    const updateCountdown = () => {
      const deadline = new Date(user.nextCheckInAt).getTime();
      const now = new Date().getTime();
      const difference = deadline - now;

      if (difference <= 0) {
        setTimeLeft('CHECK-IN OVERDUE');
      } else {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [user?.nextCheckInAt]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Evidence Vault', path: '/vault', icon: Lock },
    { name: 'Upload Evidence', path: '/vault/upload', icon: UploadCloud },
    { name: 'Emergency Contacts', path: '/contacts', icon: Users },
    { name: 'Gmail Integration', path: '/gmail', icon: Mail },
    { name: 'Check-In Config', path: '/check-in', icon: Clock },
    { name: 'Emergency Monitor', path: '/monitoring', icon: Activity },
    { name: 'Activity History', path: '/activity', icon: FileText },
    { name: 'Security Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex font-sans">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Cyber Sidebar */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[#0b0f17] border-r border-[#151d2f] flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Logo Header */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-[#151d2f]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="font-extrabold tracking-tight text-white flex items-center gap-1.5 text-base">
                  DEAD MAN'S SWITCH
                </span>
                <span className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase block">
                  FAIL-CLOSED VAULT
                </span>
              </div>
            </div>
            <button 
              className="lg:hidden text-slate-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <div className="px-3 py-2 text-[11px] font-mono uppercase text-slate-500 tracking-wider">
              Secure Operations
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/dashboard'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#101623]'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-[#151d2f] bg-[#07090e]/60">
          <div className="flex items-center gap-3 p-2 rounded-xl border border-[#151d2f] bg-[#0b0f17]">
            <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user?.fullName || 'Operator'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Cyber Navigation Bar */}
        <header className="h-20 border-b border-[#151d2f] bg-[#0b0f17]/80 backdrop-blur sticky top-0 z-30 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#1f2a42] text-slate-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono text-slate-300">
                Security Perimeter: <strong className="text-emerald-400 uppercase">ACTIVE</strong>
              </span>
            </div>
          </div>

          {/* Quick Telemetry & Deadline Timer */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-500/20 bg-cyan-950/30 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-slate-400 hidden md:inline">Check-in due in:</span>
              <span className="text-cyan-300 font-bold">{timeLeft || 'calculating...'}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-xs font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>GridFS Ready</span>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

