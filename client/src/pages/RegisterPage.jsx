import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  User, 
  Clock, 
  ArrowRight, 
  AlertCircle, 
  RefreshCw, 
  Check, 
  Eye, 
  EyeOff 
} from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    intervalType: 'daily',
    customIntervalDays: 3,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Password validation rules
  const rules = {
    length: formData.password.length >= 8,
    upper: /[A-Z]/.test(formData.password),
    lower: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
    special: /[@$!%*?&#^()_\-+=<>.,:;]/.test(formData.password),
  };

  const isPasswordValid = Object.values(rules).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Please satisfy all password complexity requirements.');
      return;
    }

    setLoading(true);

    try {
      await register({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        checkInSchedule: {
          intervalType: formData.intervalType,
          customIntervalDays: formData.intervalType === 'custom' ? Number(formData.customIntervalDays) : undefined,
        },
      });
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center py-12 px-6 lg:px-8 selection:bg-cyan-500 selection:text-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <ShieldAlert className="w-7 h-7" />
          </div>
        </Link>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          Initialize Dead Man's Switch
        </h2>
        <p className="text-xs text-slate-400 font-mono">
          Create an encrypted account with cryptographic zero-premature-release fail-safes.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-[#0b0f17] border border-[#151d2f] py-8 px-6 shadow-2xl rounded-2xl sm:px-10 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name / Alias
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Edward Snowden"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="operator@proton.me"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Master Encryption Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Checklist */}
              <div className="mt-2.5 p-3 rounded-xl border border-[#151d2f] bg-[#07090e] grid grid-cols-2 gap-2 text-[11px] font-mono">
                <span className={`flex items-center gap-1.5 ${rules.length ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" /> 8+ Characters
                </span>
                <span className={`flex items-center gap-1.5 ${rules.upper ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" /> 1 Uppercase
                </span>
                <span className={`flex items-center gap-1.5 ${rules.lower ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" /> 1 Lowercase
                </span>
                <span className={`flex items-center gap-1.5 ${rules.number ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" /> 1 Number
                </span>
                <span className={`col-span-2 flex items-center gap-1.5 ${rules.special ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <Check className="w-3.5 h-3.5" /> 1 Special Character (@$!%*?&#)
                </span>
              </div>
            </div>

            {/* Check-In Schedule Initial Preference */}
            <div>
              <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
                Check-in Frequency
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'daily', label: 'Daily (24h)' },
                  { id: 'weekly', label: 'Weekly (7d)' },
                  { id: 'custom', label: 'Custom' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, intervalType: t.id })}
                    className={`py-2 rounded-xl text-xs font-mono transition-all border ${
                      formData.intervalType === t.id
                        ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                        : 'border-[#1f2a42] bg-[#101623] text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {formData.intervalType === 'custom' && (
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400">Every:</span>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={formData.customIntervalDays}
                    onChange={(e) => setFormData({ ...formData, customIntervalDays: e.target.value })}
                    className="w-24 px-3 py-1.5 rounded-lg border border-[#1f2a42] bg-[#101623] text-xs font-mono text-white text-center"
                  />
                  <span className="text-xs font-mono text-slate-400">days</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Initializing Vault...
                </>
              ) : (
                <>
                  Create Secure Vault <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#151d2f] text-center">
            <p className="text-xs text-slate-400">
              Already initialized?{' '}
              <Link to="/login" className="font-mono text-cyan-400 hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

