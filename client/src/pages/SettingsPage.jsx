import React, { useState } from 'react';
import {
  Settings,
  Shield,
  KeyRound,
  User,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Sliders,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();

  // Profile update state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);

  // Password rotation state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);

  // Profile update submit
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    try {
      setProfileSaving(true);
      setProfileFeedback(null);
      await authApi.updateProfile({ fullName });
      await refreshUser();
      setProfileFeedback({
        type: 'success',
        message: 'Operator profile updated successfully.',
      });
    } catch (err) {
      setProfileFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  // Password rotation submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', message: 'Password must be at least 8 characters long.' });
      return;
    }

    try {
      setPasswordSaving(true);
      await authApi.changePassword({ currentPassword, newPassword });
      setPasswordFeedback({
        type: 'success',
        message: 'Password rotated successfully. Audit log record generated.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Could not change password. Please check your current password.',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  // Password strength calculator
  const calculateStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const strength = calculateStrength(newPassword);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-cyber-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Profile & Security Settings
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                Hardened
              </span>
            </h1>
            <p className="text-sm text-cyber-slate-400 mt-0.5">
              Manage operator credentials, encryption protocols, brute-force defenses, and active sessions
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl text-xs font-mono font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" /> Terminate Session
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile & Password Rotation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Operator Profile Card */}
          <div className="cyber-card p-6 bg-cyber-midnight border-cyber-slate-800 space-y-5">
            <div className="flex items-center gap-2.5 text-white font-bold text-sm">
              <User className="w-4 h-4 text-cyan-400" />
              Operator Identification
            </div>

            {profileFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                  profileFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {profileFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                {profileFeedback.message}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-cyber-slate-300 mb-1.5 uppercase">
                  Operator Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cyber-obsidian border border-cyber-slate-700 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-cyber-slate-300 mb-1.5 uppercase">
                  Primary Email (Immutable Identity)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cyber-obsidian/50 border border-cyber-slate-800 text-cyber-slate-400 text-xs font-mono cursor-not-allowed"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="cyber-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  {profileSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Profile'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Password Rotation Card */}
          <div className="cyber-card p-6 bg-cyber-midnight border-cyber-slate-800 space-y-5">
            <div className="flex items-center gap-2.5 text-white font-bold text-sm">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              Credential & Password Rotation
            </div>

            {passwordFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {passwordFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                {passwordFeedback.message}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-mono text-cyber-slate-300 mb-1.5 uppercase">
                  Current Master Password *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-cyber-obsidian border border-cyber-slate-700 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-2.5 text-cyber-slate-500 hover:text-white"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-mono text-cyber-slate-300 mb-1.5 uppercase">
                  New Master Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-cyber-obsidian border border-cyber-slate-700 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-cyber-slate-500 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="w-full h-1.5 bg-cyber-obsidian rounded-full overflow-hidden border border-cyber-slate-800">
                      <div
                        className={`h-full transition-all duration-300 ${
                          strength <= 25
                            ? 'bg-rose-500 w-1/4'
                            : strength <= 50
                            ? 'bg-amber-500 w-2/4'
                            : strength <= 75
                            ? 'bg-cyan-500 w-3/4'
                            : 'bg-emerald-500 w-full'
                        }`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-cyber-slate-400">
                      <span>Entropy Strength</span>
                      <span className={strength === 100 ? 'text-emerald-400 font-bold' : ''}>
                        {strength <= 25 ? 'Weak' : strength <= 50 ? 'Moderate' : strength <= 75 ? 'Strong' : 'Military Grade'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-mono text-cyber-slate-300 mb-1.5 uppercase">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cyber-obsidian border border-cyber-slate-700 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="cyber-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  {passwordSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Rotating...
                    </>
                  ) : (
                    'Rotate Master Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Security Architecture Telemetry */}
        <div className="space-y-6">
          <div className="cyber-card p-6 bg-cyber-midnight border-cyber-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Cryptographic Safeguards
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-cyber-obsidian border border-cyber-slate-800">
                <div className="text-[10px] text-cyber-slate-500 uppercase">Evidence Cipher</div>
                <div className="text-cyan-300 font-bold mt-0.5">AES-256-GCM</div>
                <div className="text-[10px] text-cyber-slate-400 mt-1">
                  Unique 96-bit IV per file with 128-bit authentication tag
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyber-obsidian border border-cyber-slate-800">
                <div className="text-[10px] text-cyber-slate-500 uppercase">Integrity Verification</div>
                <div className="text-emerald-300 font-bold mt-0.5">SHA-256 Checksum</div>
                <div className="text-[10px] text-cyber-slate-400 mt-1">
                  Computed pre-encryption and validated upon decryption
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyber-obsidian border border-cyber-slate-800">
                <div className="text-[10px] text-cyber-slate-500 uppercase">Brute-Force Guard</div>
                <div className="text-purple-300 font-bold mt-0.5">5-Attempt Lockout</div>
                <div className="text-[10px] text-cyber-slate-400 mt-1">
                  Automatic 2-hour account lock on consecutive password failures
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyber-obsidian border border-cyber-slate-800">
                <div className="text-[10px] text-cyber-slate-500 uppercase">Rate Limiter Policy</div>
                <div className="text-amber-300 font-bold mt-0.5">Strict Throttling</div>
                <div className="text-[10px] text-cyber-slate-400 mt-1">
                  Auth endpoints: 15 req/15m • General API: 300 req/15m
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
