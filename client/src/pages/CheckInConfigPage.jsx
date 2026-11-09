import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Bell,
  Hourglass,
  ArrowRight,
  Fingerprint,
  Sliders,
  Zap,
} from 'lucide-react';
import { checkinApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function CheckInConfigPage() {
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Form state
  const [config, setConfig] = useState({
    intervalType: 'custom',
    customUnit: 'minutes', // 'minutes', 'hours', 'days'
    customValue: 1, // default 1 min for fast testing
    graceUnit: 'minutes', // 'minutes', 'hours'
    graceValue: 1, // default 1 min grace for fast testing
    customIntervalDays: 1,
    customIntervalHours: 24,
    customIntervalMinutes: 1,
    gracePeriodHours: 2,
    gracePeriodMinutes: 1,
    reminderOffsetsHours: [6, 2],
  });

  // Telemetry state from server
  const [telemetry, setTelemetry] = useState(null);

  // Live countdown
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0, overdue: false });

  // Fetch current config from server
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await checkinApi.getConfig();
      if (res.data?.data) {
        const d = res.data.data;
        setTelemetry(d);
        if (d.schedule) {
          const s = d.schedule;
          const mins = s.customIntervalMinutes || (s.customIntervalHours ? s.customIntervalHours * 60 : 1440);
          const graceMins = s.gracePeriodMinutes || (s.gracePeriodHours ? s.gracePeriodHours * 60 : 120);

          setConfig({
            intervalType: s.intervalType || 'custom',
            customUnit: mins < 60 ? 'minutes' : (mins % 1440 === 0 ? 'days' : 'hours'),
            customValue: mins < 60 ? mins : (mins % 1440 === 0 ? mins / 1440 : Math.round(mins / 60)),
            graceUnit: graceMins < 60 ? 'minutes' : 'hours',
            graceValue: graceMins < 60 ? graceMins : Math.round(graceMins / 60),
            customIntervalDays: s.customIntervalDays || 1,
            customIntervalHours: s.customIntervalHours || 24,
            customIntervalMinutes: mins,
            gracePeriodHours: s.gracePeriodHours || 2,
            gracePeriodMinutes: graceMins,
            reminderOffsetsHours: s.reminderOffsetsHours || [6, 2],
          });
        }
      }
    } catch (err) {
      console.error('Failed to load check-in schedule config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Update countdown timer
  useEffect(() => {
    const targetDate = telemetry?.nextCheckInAt || user?.nextCheckInAt;
    if (!targetDate) return;

    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, overdue: true });
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ hours, minutes, seconds, overdue: false });
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [telemetry?.nextCheckInAt, user?.nextCheckInAt]);

  // Handle schedule save
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);

      // Compute total minutes for deadline
      let totalMins = 1440;
      if (config.intervalType === 'daily') {
        totalMins = 1440;
      } else if (config.intervalType === 'weekly') {
        totalMins = 10080;
      } else {
        const val = Math.max(1, Number(config.customValue) || 1);
        if (config.customUnit === 'minutes') totalMins = val;
        else if (config.customUnit === 'hours') totalMins = val * 60;
        else if (config.customUnit === 'days') totalMins = val * 1440;
      }

      // Compute grace period minutes
      let graceMins = 120;
      const gVal = Math.max(1, Number(config.graceValue) || 1);
      if (config.graceUnit === 'minutes') {
        graceMins = gVal;
      } else {
        graceMins = gVal * 60;
      }

      const payload = {
        intervalType: config.intervalType,
        customIntervalMinutes: totalMins,
        customIntervalHours: Math.round((totalMins / 60) * 100) / 100,
        customIntervalDays: Math.max(1, Math.round(totalMins / 1440)),
        gracePeriodMinutes: graceMins,
        gracePeriodHours: Math.round((graceMins / 60) * 100) / 100,
        reminderOffsetsHours: config.reminderOffsetsHours,
      };

      const res = await checkinApi.updateConfig(payload);
      setTelemetry(res.data.data);
      await refreshUser();

      setFeedback({
        type: 'success',
        title: 'Schedule Synchronized',
        message: `Check-in cadence set to ${totalMins >= 60 ? (totalMins / 60).toFixed(1) + ' hrs' : totalMins + ' mins'} with a ${graceMins >= 60 ? (graceMins / 60).toFixed(1) + ' hrs' : graceMins + ' mins'} safety buffer.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Update Failed',
        message: err.response?.data?.message || 'Could not update check-in schedule.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Immediate manual check-in
  const handleCheckInNow = async () => {
    try {
      setCheckingIn(true);
      const res = await checkinApi.checkInNow();
      await refreshUser();
      await fetchConfig();

      setFeedback({
        type: 'success',
        title: 'Presence Confirmed ✓',
        message: 'Deadline reset and audit record created. Background timers restarted.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Check-in Error',
        message: err.response?.data?.message || 'Failed to register check-in.',
      });
    } finally {
      setCheckingIn(false);
    }
  };

  // Toggle reminder offset
  const toggleReminder = (hours) => {
    const current = config.reminderOffsetsHours || [];
    if (current.includes(hours)) {
      if (current.length > 1) {
        setConfig({ ...config, reminderOffsetsHours: current.filter((h) => h !== hours) });
      }
    } else {
      setConfig({ ...config, reminderOffsetsHours: [...current, hours].sort((a, b) => b - a) });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-cyber-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Check-In Schedule Engine
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                BullMQ + Redis
              </span>
            </h1>
            <p className="text-sm text-cyber-slate-400 mt-0.5">
              Configure presence verification cadences, warning thresholds, and fail-closed grace periods
            </p>
          </div>
        </div>

        {/* Immediate Presence Button */}
        <button
          onClick={handleCheckInNow}
          disabled={checkingIn}
          className="self-start sm:self-auto px-5 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-teal-400 text-black hover:from-cyan-400 hover:to-teal-300 shadow-glow-cyan transition-all flex items-center gap-2 active:scale-95"
        >
          {checkingIn ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
            </>
          ) : (
            <>
              <Fingerprint className="w-4 h-4" /> Confirm Safety Now
            </>
          )}
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            )}
            <div>
              <div className="font-semibold text-sm">{feedback.title}</div>
              <div className="text-xs opacity-90 mt-0.5">{feedback.message}</div>
            </div>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-70 hover:opacity-100 p-1">
            &times;
          </button>
        </div>
      )}

      {/* Live Telemetry Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Countdown */}
        <div className="cyber-card p-5 bg-cyber-midnight border-cyber-slate-800">
          <div className="flex items-center justify-between text-xs font-mono text-cyber-slate-400 mb-2">
            <span>Next Deadline</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${countdown.overdue ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
            {countdown.overdue ? 'OVERDUE' : `${countdown.hours}h ${countdown.minutes}m ${countdown.seconds}s`}
          </div>
          <div className="text-[11px] text-cyber-slate-500 font-mono mt-1">
            {telemetry?.nextCheckInAt ? new Date(telemetry.nextCheckInAt).toLocaleString() : 'Loading...'}
          </div>
        </div>

        {/* Metric 2: State */}
        <div className="cyber-card p-5 bg-cyber-midnight border-cyber-slate-800">
          <div className="flex items-center justify-between text-xs font-mono text-cyber-slate-400 mb-2">
            <span>Vault Perimeter Status</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                telemetry?.status === 'ACTIVE'
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-rose-400 animate-pulse'
              }`}
            />
            {telemetry?.status || 'ACTIVE'}
          </div>
          <div className="text-[11px] text-cyber-slate-500 font-mono mt-1">
            {telemetry?.status === 'ACTIVE' ? 'Perimeter Secure' : 'Grace Period Activated'}
          </div>
        </div>

        {/* Metric 3: Grace Period */}
        <div className="cyber-card p-5 bg-cyber-midnight border-cyber-slate-800">
          <div className="flex items-center justify-between text-xs font-mono text-cyber-slate-400 mb-2">
            <span>Grace Period Buffer</span>
            <Hourglass className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {config.gracePeriodHours} Hours
          </div>
          <div className="text-[11px] text-cyber-slate-500 font-mono mt-1">
            Zero premature release buffer
          </div>
        </div>

        {/* Metric 4: Total Check-ins */}
        <div className="cyber-card p-5 bg-cyber-midnight border-cyber-slate-800">
          <div className="flex items-center justify-between text-xs font-mono text-cyber-slate-400 mb-2">
            <span>Lifetime Check-Ins</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-white">
            {telemetry?.checkInCount || 0}
          </div>
          <div className="text-[11px] text-cyber-slate-500 font-mono mt-1">
            Recorded in immutable audit logs
          </div>
        </div>
      </div>

      {/* Visual Safety Timeline */}
      <div className="cyber-card p-6 bg-cyber-midnight border-cyber-slate-800">
        <h3 className="text-xs font-mono uppercase tracking-wider text-cyber-slate-400 mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Fail-Closed Lifecycle Sequence
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          <div className="bg-cyber-obsidian p-4 rounded-xl border border-emerald-500/30">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              1. Presence Active
            </div>
            <p className="text-[11px] text-cyber-slate-400 mt-1">
              User operates normally. Countdown runs toward next deadline.
            </p>
          </div>

          <div className="bg-cyber-obsidian p-4 rounded-xl border border-cyan-500/30">
            <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              2. Early Warnings
            </div>
            <p className="text-[11px] text-cyber-slate-400 mt-1">
              Automated reminders dispatched at configured hours via Gmail API.
            </p>
          </div>

          <div className="bg-cyber-obsidian p-4 rounded-xl border border-amber-500/30">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              3. Deadline Expiry
            </div>
            <p className="text-[11px] text-cyber-slate-400 mt-1">
              Missed deadline initiates {config.gracePeriodHours}h grace period. Zero release.
            </p>
          </div>

          <div className="bg-cyber-obsidian p-4 rounded-xl border border-rose-500/30">
            <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              4. Verification Gate
            </div>
            <p className="text-[11px] text-cyber-slate-400 mt-1">
              Multi-stage verification begins. Release requires explicit authorization.
            </p>
          </div>
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSave} className="cyber-card p-6 bg-cyber-midnight border-cyber-slate-800 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Configure Check-In Cadence</h2>
          <p className="text-xs text-cyber-slate-400 mt-0.5">
            Select how often you must confirm your presence before safety warnings are triggered
          </p>
        </div>

        {/* 1. Cadence Picker */}
        <div className="space-y-3">
          <label className="block text-xs font-mono uppercase tracking-wider text-cyber-slate-300">
            Cadence Frequency *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Daily */}
            <div
              onClick={() => setConfig({ ...config, intervalType: 'daily' })}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                config.intervalType === 'daily'
                  ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-glow-cyan/20'
                  : 'bg-cyber-obsidian border-cyber-slate-800 text-cyber-slate-400 hover:border-cyber-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">Daily</span>
                {config.intervalType === 'daily' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-xs text-cyber-slate-400 mt-1">
                Every 24 hours. Recommended for high-security environments.
              </p>
            </div>

            {/* Weekly */}
            <div
              onClick={() => setConfig({ ...config, intervalType: 'weekly' })}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                config.intervalType === 'weekly'
                  ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-glow-cyan/20'
                  : 'bg-cyber-obsidian border-cyber-slate-800 text-cyber-slate-400 hover:border-cyber-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">Weekly</span>
                {config.intervalType === 'weekly' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-xs text-cyber-slate-400 mt-1">
                Every 7 days. Suitable for lower-frequency monitoring.
              </p>
            </div>

            {/* Custom */}
            <div
              onClick={() => setConfig({ ...config, intervalType: 'custom' })}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                config.intervalType === 'custom'
                  ? 'bg-cyan-500/10 border-cyan-500 text-white shadow-glow-cyan/20'
                  : 'bg-cyber-obsidian border-cyber-slate-800 text-cyber-slate-400 hover:border-cyber-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">Custom Interval</span>
                {config.intervalType === 'custom' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-xs text-cyber-slate-400 mt-1">
                Configure custom hours or days tailored to your schedule.
              </p>
            </div>
          </div>
        </div>

        {/* Custom Interval Builder (Minutes / Hours / Days) */}
        {config.intervalType === 'custom' && (
          <div className="p-5 rounded-xl bg-cyber-obsidian border border-cyan-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                Custom Deadline Interval *
              </label>
              <span className="text-[11px] font-mono text-cyan-300">
                Supports testing down to 1 minute!
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="1"
                max={config.customUnit === 'minutes' ? 525600 : config.customUnit === 'hours' ? 8760 : 365}
                value={config.customValue}
                onChange={(e) => setConfig({ ...config, customValue: Math.max(1, Number(e.target.value) || 1) })}
                className="w-32 px-3.5 py-2.5 rounded-xl bg-cyber-midnight border border-cyber-slate-700 text-white font-mono text-base font-bold focus:border-cyan-500 focus:outline-none"
              />

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-cyber-midnight border border-cyber-slate-700">
                {['minutes', 'hours', 'days'].map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setConfig({ ...config, customUnit: unit })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                      config.customUnit === unit
                        ? 'bg-cyan-500 text-black shadow-glow-cyan/20'
                        : 'text-cyber-slate-400 hover:text-white'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>

              {/* Quick Preset Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-cyber-slate-500 mr-1">Presets:</span>
                {[
                  { label: '1 min (test)', unit: 'minutes', val: 1 },
                  { label: '5 min', unit: 'minutes', val: 5 },
                  { label: '30 min', unit: 'minutes', val: 30 },
                  { label: '1 hour', unit: 'hours', val: 1 },
                  { label: '12 hours', unit: 'hours', val: 12 },
                  { label: '1 day', unit: 'days', val: 1 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setConfig({ ...config, customUnit: preset.unit, customValue: preset.val })}
                    className="px-2.5 py-1 rounded-lg border border-cyber-slate-700 text-[10px] font-mono text-cyber-slate-400 hover:text-cyan-300 hover:border-cyan-500/40"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. Grace Period Buffer (with Custom Minutes & Hours support) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-mono uppercase tracking-wider text-cyber-slate-300">
              Emergency Grace Buffer (Safety Window) *
            </label>
            <span className="text-[11px] font-mono text-purple-400">
              Notice sent to host email; evidence auto-dispatched if buffer expires
            </span>
          </div>

          <div className="p-5 rounded-xl bg-cyber-obsidian border border-purple-500/30 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="number"
                min="1"
                max={config.graceUnit === 'minutes' ? 10080 : 168}
                value={config.graceValue}
                onChange={(e) => setConfig({ ...config, graceValue: Math.max(1, Number(e.target.value) || 1) })}
                className="w-32 px-3.5 py-2.5 rounded-xl bg-cyber-midnight border border-cyber-slate-700 text-white font-mono text-base font-bold focus:border-purple-500 focus:outline-none"
              />

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-cyber-midnight border border-cyber-slate-700">
                {['minutes', 'hours'].map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setConfig({ ...config, graceUnit: unit })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                      config.graceUnit === unit
                        ? 'bg-purple-500 text-white shadow-glow-purple/20'
                        : 'text-cyber-slate-400 hover:text-white'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>

              {/* Quick Grace Preset Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-cyber-slate-500 mr-1">Presets:</span>
                {[
                  { label: '1 min (test)', unit: 'minutes', val: 1 },
                  { label: '5 min', unit: 'minutes', val: 5 },
                  { label: '15 min', unit: 'minutes', val: 15 },
                  { label: '1 hour', unit: 'hours', val: 1 },
                  { label: '2 hours', unit: 'hours', val: 2 },
                  { label: '24 hours', unit: 'hours', val: 24 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setConfig({ ...config, graceUnit: preset.unit, graceValue: preset.val })}
                    className="px-2.5 py-1 rounded-lg border border-cyber-slate-700 text-[10px] font-mono text-cyber-slate-400 hover:text-purple-300 hover:border-purple-500/40"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-cyber-slate-400">
              Window during which you can click "I Am Safe" to cancel the release before the system automatically sends all files to your emergency contacts.
            </p>
          </div>
        </div>

        {/* 3. Early Warning Notifications */}
        <div className="space-y-2">
          <label className="block text-xs font-mono uppercase tracking-wider text-cyber-slate-300">
            Automated Reminder Offsets (Dispatched via Gmail API)
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[12, 6, 2].map((hours) => {
              const isChecked = config.reminderOffsetsHours?.includes(hours);
              return (
                <div
                  key={hours}
                  onClick={() => toggleReminder(hours)}
                  className={`p-3 rounded-xl border cursor-pointer text-xs font-mono flex items-center justify-between transition-all ${
                    isChecked
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                      : 'bg-cyber-obsidian border-cyber-slate-800 text-cyber-slate-400'
                  }`}
                >
                  <span>{hours} Hours Before</span>
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${isChecked ? 'bg-cyan-500 border-cyan-400 text-black font-bold' : 'border-cyber-slate-700'}`}>
                    {isChecked && '✓'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-cyber-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="cyber-btn-primary px-8 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-glow-cyan"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Rescheduling Queues...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Save & Synchronize Schedule
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
