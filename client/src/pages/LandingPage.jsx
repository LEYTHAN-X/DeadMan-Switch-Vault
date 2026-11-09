import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  Clock, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Fingerprint, 
  EyeOff, 
  Terminal,
  ShieldCheck
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-cyan-500 selection:text-black">
      {/* Navigation */}
      <nav className="border-b border-[#151d2f] bg-[#0b0f17]/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white flex items-center gap-2 text-base">
                DEAD MAN'S SWITCH
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-400 bg-cyan-950/40">
                  SECURE VAULT
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white hover:bg-[#101623] transition-all"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-cyan-500 text-black hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center gap-1.5"
            >
              Initialize Switch <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-6 border-b border-[#151d2f]">
        {/* Cyber grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#101623_1px,transparent_1px),linear-gradient(to_bottom,#101623_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs font-mono">
            <Fingerprint className="w-4 h-4 text-cyan-400" />
            Fail-Closed Emergency Evidence Disclosure Protocol
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
            Secure Evidence Vault & <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400">
              Automated Emergency Dispatch
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-400 text-base md:text-lg leading-relaxed">
            Protect sensitive whistleblowing, investigative, and legal assets in an AES-256-GCM encrypted vault. 
            Safeguards ensure evidence is dispatched to verified recipients via your authenticated Gmail only when all 
            multi-stage verification checks are completely exhausted.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-mono font-bold bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.35)] transition-all flex items-center justify-center gap-2"
            >
              Get Started Now <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm font-mono font-medium border border-[#1f2a42] bg-[#0b0f17] text-slate-300 hover:text-white hover:border-cyan-500/40 transition-all flex items-center justify-center gap-2"
            >
              <Terminal className="w-4 h-4 text-cyan-400" /> Access Vault Terminal
            </Link>
          </div>

          {/* Core Safe Guards Banner */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Never releases solely on timer expiry
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> AES-256-GCM GridFS Encryption
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Zero social media auto-broadcasts
            </span>
          </div>
        </div>
      </section>

      {/* Feature Pillar Cards */}
      <section className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">
            Cryptographic Safety Pillars
          </span>
          <h2 className="text-3xl font-extrabold text-white">
            Designed for Absolute Discretion & Fail-Closed Integrity
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-8 rounded-2xl border border-[#151d2f] bg-[#0b0f17] hover:border-cyan-500/30 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">Encrypted Evidence Vault</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Upload documents, audio recordings, video files, and photographs. Files are encrypted with AES-256-GCM before passing into MongoDB GridFS. SHA-256 checksums prevent tampering.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-8 rounded-2xl border border-[#151d2f] bg-[#0b0f17] hover:border-cyan-500/30 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">Resilient Check-In Schedules</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Configure daily, weekly, or custom check-in frequencies. Receive multi-channel automated reminders. Check in with a single tap to renew the timer securely.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-8 rounded-2xl border border-[#151d2f] bg-[#0b0f17] hover:border-cyan-500/30 transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">Granular Gmail OAuth 2.0</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Connect via Google OAuth 2.0 with minimal send-only permissions. Define trusted recipients and selectively map specific files to individual contacts.
            </p>
          </div>
        </div>
      </section>

      {/* Emergency State Machine Workflow */}
      <section className="py-20 px-6 border-t border-[#151d2f] bg-[#090d14]">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
              State Machine Safeguards
            </span>
            <h2 className="text-3xl font-extrabold text-white">
              Why Missed Check-Ins Never Equate to Release
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Our 6-stage protocol ensures false alarms, device losses, or connectivity outages never trigger premature disclosures.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-center">
            {[
              { step: '01', state: 'ACTIVE', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20', desc: 'Normal safe monitoring' },
              { step: '02', state: 'OVERDUE', color: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20', desc: 'Deadline lapsed, retrying' },
              { step: '03', state: 'WARNING', color: 'border-amber-500/40 text-amber-400 bg-amber-950/20', desc: 'Urgent reminder dispatched' },
              { step: '04', state: 'GRACE PERIOD', color: 'border-orange-500/40 text-orange-400 bg-orange-950/20', desc: 'Extended safety window' },
              { step: '05', state: 'VERIFICATION', color: 'border-purple-500/40 text-purple-400 bg-purple-950/20', desc: 'Secondary ping attempts' },
              { step: '06', state: 'AUTHORIZED', color: 'border-red-500/40 text-red-400 bg-red-950/20', desc: 'Only after all fail-safes' },
            ].map((s) => (
              <div key={s.step} className={`p-4 rounded-xl border ${s.color} flex flex-col justify-between space-y-2`}>
                <span className="text-[10px] font-mono opacity-70">STAGE {s.step}</span>
                <span className="text-xs font-bold font-mono uppercase tracking-wider">{s.state}</span>
                <span className="text-[10px] text-slate-400 leading-tight">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#151d2f] py-8 px-6 text-center text-xs font-mono text-slate-500 bg-[#07090e]">
        <p>Digital Dead Man's Switch (DMS) • Fail-Closed Architecture • Production Security Grade</p>
      </footer>
    </div>
  );
}

