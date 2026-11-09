import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, evidenceApi, contactsApi, gmailApi } from '../services/api';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Lock, 
  Users, 
  Mail, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  UploadCloud, 
  ArrowRight,
  Fingerprint,
  Radio,
  FileCheck2,
  Calendar
} from 'lucide-react';

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0, overdue: false });
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [verifiedContactCount, setVerifiedContactCount] = useState(0);
  const [gmailStatus, setGmailStatus] = useState({ connected: false, email: '' });

  // Fetch real evidence, contact, and Gmail stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [vaultRes, contactsRes, gmailRes] = await Promise.allSettled([
          evidenceApi.list(),
          contactsApi.list(),
          gmailApi.getStatus(),
        ]);
        
        if (vaultRes.status === 'fulfilled') {
          setEvidenceCount(vaultRes.value.data?.count || 0);
        }
        if (contactsRes.status === 'fulfilled') {
          const contacts = contactsRes.value.data?.data || [];
          setVerifiedContactCount(contacts.filter((c) => c.verificationStatus === 'VERIFIED').length);
        }
        if (gmailRes.status === 'fulfilled') {
          const gData = gmailRes.value.data;
          setGmailStatus({
            connected: !!gData?.connected,
            email: gData?.connection?.gmailAddress || '',
          });
        }
      } catch (err) {
        console.error('Failed to query dashboard stats:', err);
      }
    };
    fetchStats();
  }, []);

  // Calculate remaining time
  useEffect(() => {
    if (!user?.nextCheckInAt) return;

    const calc = () => {
      const target = new Date(user.nextCheckInAt).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, overdue: true });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ hours, minutes, seconds, overdue: false });
      }
    };

    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [user?.nextCheckInAt]);

  const handleManualCheckIn = async () => {
    setCheckingIn(true);
    setCheckInSuccess(false);

    try {
      await authApi.checkIn();
      await refreshUser();
      setCheckInSuccess(true);
      setTimeout(() => setCheckInSuccess(false), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Welcome & Check-In Action Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#0b0f17] via-[#101623] to-[#0b0f17] p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Vault Perimeter Secure • State: {user?.status || 'ACTIVE'}
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome back, {user?.fullName || 'Operator'}
            </h1>
            <p className="text-xs md:text-sm text-slate-400 font-mono">
              Identity: <span className="text-cyan-300">{user?.email}</span> • Protocol: {user?.checkInSchedule?.intervalType || 'daily'}
            </p>
          </div>

          {/* Big Check-in Button */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleManualCheckIn}
              disabled={checkingIn}
              className={`w-full sm:w-auto px-6 py-4 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-3 shadow-xl ${
                checkInSuccess
                  ? 'bg-emerald-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                  : 'bg-gradient-to-r from-cyan-500 to-teal-400 text-black hover:from-cyan-400 hover:to-teal-300 shadow-[0_0_25px_rgba(6,182,212,0.35)] active:scale-95'
              }`}
            >
              {checkingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Presence...
                </>
              ) : checkInSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-black" /> Presence Confirmed!
                </>
              ) : (
                <>
                  <Fingerprint className="w-5 h-5" /> I Am Safe (Check In Now)
                </>
              )}
            </button>
          </div>
        </div>

        {checkInSuccess && (
          <div className="mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Check-in registered in immutable audit log. Next deadline has been recalculated.
          </div>
        )}
      </div>

      {/* Grid of Key Diagnostic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Countdown to Deadline */}
        <div className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Next Check-In Deadline</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className={`text-2xl font-black font-mono tracking-tight ${countdown.overdue ? 'text-red-400' : 'text-white'}`}>
              {countdown.overdue ? (
                'OVERDUE'
              ) : (
                `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              Due: {formatDate(user?.nextCheckInAt)}
            </div>
          </div>
          <div className="pt-2 border-t border-[#151d2f] text-[11px] font-mono text-cyan-400">
            Interval: {user?.checkInSchedule?.intervalType || 'daily'}
          </div>
        </div>

        {/* Metric 2: Evidence Count */}
        <div className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Evidence In Vault</span>
            <Lock className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">{evidenceCount} {evidenceCount === 1 ? 'Item' : 'Items'}</div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              AES-256-GCM GridFS Encrypted
            </div>
          </div>
          <Link
            to="/vault/upload"
            className="pt-2 border-t border-[#151d2f] text-[11px] font-mono text-purple-400 hover:text-purple-300 flex items-center justify-between"
          >
            <span>Deposit Evidence</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Metric 3: Verified Recipients */}
        <div className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Emergency Contacts</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-white">{verifiedContactCount} Verified</div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              Designated recipients configured
            </div>
          </div>
          <Link
            to="/contacts"
            className="pt-2 border-t border-[#151d2f] text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center justify-between"
          >
            <span>Manage Contacts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Metric 4: Gmail OAuth Integration */}
        <div className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>Gmail Integration</span>
            <Mail className={`w-4 h-4 ${gmailStatus.connected ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <div className={`text-2xl font-black font-mono ${gmailStatus.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
              {gmailStatus.connected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1 truncate" title={gmailStatus.email || 'Google OAuth 2.0 required'}>
              {gmailStatus.connected ? gmailStatus.email : 'Google OAuth 2.0 required'}
            </div>
          </div>
          <Link
            to="/gmail"
            className={`pt-2 border-t border-[#151d2f] text-[11px] font-mono flex items-center justify-between ${
              gmailStatus.connected
                ? 'text-emerald-400 hover:text-emerald-300'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <span>{gmailStatus.connected ? 'View Gateway' : 'Connect Gmail'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Emergency State Machine Monitor */}
      <div className="p-6 rounded-2xl border border-[#151d2f] bg-[#0b0f17] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Emergency State Machine Workflow
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Fail-closed progression • A missed check-in never releases evidence prematurely.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 text-xs font-mono uppercase">
            Current Stage: ACTIVE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          {[
            { id: 1, name: 'ACTIVE', state: 'active', desc: 'User safely checking in regularly' },
            { id: 2, name: 'OVERDUE', state: 'standby', desc: 'Deadline elapsed; reminder queued' },
            { id: 3, name: 'WARNING', state: 'standby', desc: 'High-priority alert dispatched' },
            { id: 4, name: 'GRACE PERIOD', state: 'standby', desc: 'Extended safeguard buffer' },
            { id: 5, name: 'VERIFICATION', state: 'standby', desc: 'Secondary ping & identity check' },
            { id: 6, name: 'AUTHORIZED', state: 'standby', desc: 'Encrypted release to recipients' },
          ].map((stage) => {
            const isCurrent = stage.state === 'active';
            return (
              <div
                key={stage.id}
                className={`p-4 rounded-xl border text-xs font-mono flex flex-col justify-between space-y-2 ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-950/30 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50'
                    : 'border-[#151d2f] bg-[#07090e]/60 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] opacity-70">STAGE {stage.id}</span>
                  {isCurrent && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                </div>
                <div className={`font-bold uppercase tracking-wider ${isCurrent ? 'text-emerald-400' : ''}`}>
                  {stage.name}
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  {stage.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Recent Activity & Check-In History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Audit Log */}
        <div className="p-6 rounded-2xl border border-[#151d2f] bg-[#0b0f17] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              Recent System Activity
            </h3>
            <span className="text-[10px] font-mono text-slate-500 uppercase">
              Immutable Records
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl border border-[#151d2f] bg-[#07090e] flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-200">Session authenticated via JWT token</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  IP: 127.0.0.1 • User-Agent: Mozilla/5.0
                </p>
              </div>
              <span className="text-[10px] text-slate-500">Just now</span>
            </div>

            <div className="p-3 rounded-xl border border-[#151d2f] bg-[#07090e] flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-200">Last confirmed check-in timestamp</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {formatDate(user?.lastCheckIn)}
                </p>
              </div>
              <span className="text-[10px] text-slate-500">Verified</span>
            </div>

            <div className="p-3 rounded-xl border border-[#151d2f] bg-[#07090e] flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-200">Cryptographic vault initialized</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  GridFS ready • Master Key: AES-256-GCM
                </p>
              </div>
              <span className="text-[10px] text-slate-500">System</span>
            </div>
          </div>
        </div>

        {/* Security & Fail-Closed Protocols Info */}
        <div className="p-6 rounded-2xl border border-[#151d2f] bg-[#0b0f17] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Fail-Closed Security Directives
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 uppercase">
              Enforced
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-slate-300">
              <strong className="text-emerald-400 font-mono block mb-1">
                Zero Premature Release Guarantee
              </strong>
              If you miss a scheduled check-in due to travel, lost battery, or broken phone, evidence will NOT be released. 
              The system enters multi-stage warning and grace periods to protect your privacy.
            </div>

            <div className="p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-950/20 text-slate-300">
              <strong className="text-cyan-400 font-mono block mb-1">
                Gmail OAuth Delivery Protocol
              </strong>
              Evidence notifications are sent directly through your authenticated Gmail account. No third-party relay or social media broadcast will ever be used.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

