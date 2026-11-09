import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Lock,
  RefreshCw,
  XCircle,
  Play,
  KeyRound,
  FileText,
  Clock,
  ArrowRight,
  Fingerprint,
  Hourglass,
} from 'lucide-react';
import { emergencyApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STAGES = [
  { key: 'ACTIVE', label: '1. Active', desc: 'Perimeter Secure' },
  { key: 'CHECK_IN_OVERDUE', label: '2. Overdue', desc: 'Host Notice Sent' },
  { key: 'GRACE_PERIOD', label: '3. Grace Buffer', desc: '1-2h Final Window' },
  { key: 'AUTHORIZED_RELEASE', label: '4. Released', desc: 'Auto-Dispatched to Contacts' },
];

export default function MonitoringPage() {
  const { user, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Verification input
  const [verificationInput, setVerificationInput] = useState('');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await emergencyApi.getStatus();
      setData(res.data?.data);
    } catch (err) {
      console.error('Failed to query emergency status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const currentStage = data?.currentStage || user?.status || 'ACTIVE';

  // Find active step index (0 to 6)
  const currentStepIndex = STAGES.findIndex((s) => s.key === currentStage);

  // Cancel Emergency
  const handleCancelEmergency = async () => {
    try {
      setCancelling(true);
      setFeedback(null);
      const res = await emergencyApi.cancel('Operator confirmed safety via monitoring console');
      setData((prev) => (prev ? { ...prev, currentStage: 'ACTIVE' } : { currentStage: 'ACTIVE' }));
      setFeedback({
        type: 'success',
        title: 'Emergency Cancelled ✓',
        message: 'Account restored to ACTIVE status. Timers rescheduled.',
      });
      await refreshUser();
      await fetchStatus();
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Cancellation Failed',
        message: err.response?.data?.message || 'Could not cancel emergency.',
      });
    } finally {
      setCancelling(false);
    }
  };

  // Step simulation (Demo / Test)
  const handleSimulateEscalation = async () => {
    try {
      setEscalating(true);
      setFeedback(null);
      const res = await emergencyApi.simulateEscalate();
      setFeedback({
        type: 'info',
        title: 'State Transition Triggered',
        message: res.data?.message || 'Stage advanced in state machine pipeline.',
      });
      await refreshUser();
      await fetchStatus();
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Escalation Failed',
        message: err.response?.data?.message || 'Transition blocked by fail-closed safeguards.',
      });
    } finally {
      setEscalating(false);
    }
  };

  // Submit verification code
  const handleConfirmCode = async (e) => {
    e.preventDefault();
    if (!verificationInput) return;
    try {
      setActionLoading(true);
      const res = await emergencyApi.verify(verificationInput);
      setFeedback({
        type: 'success',
        title: 'Verification Confirmed ✓',
        message: res.data.message,
      });
      setVerificationInput('');
      await fetchStatus();
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Verification Failed',
        message: err.response?.data?.message || 'Invalid or expired verification code.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Approve release
  const handleApproveRelease = async () => {
    try {
      setActionLoading(true);
      const res = await emergencyApi.approve(true);
      setFeedback({
        type: 'success',
        title: 'Release Gate Approved',
        message: res.data.message,
      });
      await fetchStatus();
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Approval Failed',
        message: err.response?.data?.message || 'Could not approve release.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Final release execution
  const handleExecuteRelease = async () => {
    try {
      setActionLoading(true);
      const res = await emergencyApi.executeRelease();
      setFeedback({
        type: 'success',
        title: 'Disclosure Completed',
        message: `Dispatched ${res.data.receipts?.length || 0} evidence packages via Gmail API.`,
      });
      await fetchStatus();
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Release Halted (Fail-Closed)',
        message: err.response?.data?.message || 'Release aborted by fail-closed safeguard.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-cyber-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Emergency Monitoring & State Machine
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                Fail-Closed Engine
              </span>
            </h1>
            <p className="text-sm text-cyber-slate-400 mt-0.5">
              Multi-stage emergency lifecycle tracking, verification checkpoints, and fail-safe release controls
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-medium text-cyber-slate-300 hover:text-white bg-cyber-midnight border border-cyber-slate-700 hover:border-cyan-500/50 transition-all flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          Refresh Pipeline
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : feedback.type === 'info'
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            {feedback.type === 'info' && <Activity className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            {feedback.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
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

      {/* Main Status Hero Card */}
      <div
        className={`cyber-card p-6 border relative overflow-hidden bg-cyber-midnight ${
          currentStage === 'ACTIVE'
            ? 'border-emerald-500/30'
            : currentStage === 'AUTHORIZED_RELEASE'
            ? 'border-purple-500/40'
            : 'border-rose-500/50 bg-gradient-to-r from-rose-950/20 via-cyber-midnight to-cyber-midnight'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${
                currentStage === 'ACTIVE'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
              }`}
            >
              {currentStage === 'ACTIVE' ? (
                <ShieldCheck className="w-8 h-8" />
              ) : (
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-xs font-mono font-semibold uppercase px-2.5 py-0.5 rounded border ${
                    currentStage === 'ACTIVE'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse'
                  }`}
                >
                  Current State: {currentStage}
                </span>
                <span className="text-xs text-cyber-slate-400 font-mono">
                  Stage {currentStepIndex >= 0 ? currentStepIndex + 1 : 1} of {STAGES.length}
                </span>
              </div>

              <h2 className="text-xl font-bold text-white mt-1.5">
                {currentStage === 'ACTIVE'
                  ? 'Vault Perimeter Fully Secure'
                  : currentStage === 'AUTHORIZED_RELEASE'
                  ? 'Authorized Disclosure Completed'
                  : 'Emergency Workflow Escalating'}
              </h2>
              <p className="text-xs text-cyber-slate-400 mt-0.5">
                {currentStage === 'ACTIVE'
                  ? 'Zero abnormal events detected. Check-in schedule operating nominally.'
                  : 'Safety checks in progress. Fail-closed gates prevent unverified disclosure.'}
              </p>
            </div>
          </div>

          {/* Action Button: Cancel Emergency / Confirm Safety */}
          <div className="flex items-center gap-3">
            {currentStage !== 'ACTIVE' && (
              <button
                onClick={handleCancelEmergency}
                disabled={cancelling}
                className="px-5 py-3 rounded-xl font-mono text-xs font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-400 text-black shadow-glow-cyan transition-all flex items-center gap-2 active:scale-95"
              >
                {cancelling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Cancelling...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" /> Cancel Emergency & Restore Safety
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Visual State Machine Pipeline Flow */}
      <div className="cyber-card p-6 bg-cyber-midnight border-cyber-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-cyber-slate-300">
            Multi-Stage State Machine Pipeline (Fail-Closed)
          </h3>
          <span className="text-[11px] font-mono text-cyan-400">
            A timer expiring NEVER releases evidence
          </span>
        </div>

        {/* 4-Stage Horizontal / Stacked Pipeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {STAGES.map((s, idx) => {
            const isPassed = currentStepIndex > idx;
            const isCurrent = currentStepIndex === idx;

            return (
              <div
                key={s.key}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? s.key === 'ACTIVE'
                      ? 'bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.25)] text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.25)]'
                    : isPassed
                    ? 'bg-cyber-obsidian border-emerald-500/40 text-emerald-300'
                    : 'bg-cyber-obsidian/40 border-cyber-slate-800 text-cyber-slate-500 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-bold">{s.label}</span>
                    {isCurrent && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          s.key === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'
                        }`}
                      />
                    )}
                    {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-[11px] text-cyber-slate-300 font-sans mt-1">
                    {s.desc}
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-cyber-slate-800 text-[10px] font-mono uppercase">
                  {isCurrent ? (
                    <span className={s.key === 'ACTIVE' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      ● Active Stage
                    </span>
                  ) : isPassed ? (
                    <span className="text-emerald-400">✓ Completed</span>
                  ) : (
                    <span>○ Pending</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage Action Controls */}
      <div className="cyber-card p-6 bg-cyber-midnight border-cyber-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-cyan-400" />
          Active Stage Controls & Verification Gates
        </h3>

        {/* If in ACTIVE */}
        {currentStage === 'ACTIVE' && (
          <div className="p-4 rounded-xl bg-cyber-obsidian border border-cyber-slate-800 text-xs text-cyber-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white">Automated Dead Man's Switch Active</p>
              <p className="mt-0.5">
                Check-in deadline is running. If time expires, the system notifies you (the host) and grants a 1–2 hour safety buffer. If no confirmation is received, evidence is automatically released to all verified contacts without manual barriers.
              </p>
            </div>
            <button
              onClick={handleSimulateEscalation}
              disabled={escalating}
              className="px-4 py-2 rounded-lg bg-cyber-midnight border border-cyan-500/40 text-cyan-300 hover:text-white font-mono text-xs flex items-center gap-2 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              Simulate Deadline Missed ({STAGES[1]?.label})
            </button>
          </div>
        )}

        {/* If in GRACE_PERIOD */}
        {currentStage === 'GRACE_PERIOD' && (
          <div className="p-4 rounded-xl bg-cyber-obsidian border border-amber-500/40 space-y-3">
            <div className="text-xs text-amber-300 font-bold flex items-center gap-2">
              <Hourglass className="w-4 h-4 text-amber-400 animate-spin" />
              Safety Buffer Active: Check-In Notice Sent to Host Email
            </div>
            <p className="text-xs text-cyber-slate-400">
              Your Dead Man's Switch deadline expired. A safety reminder has been emailed to your address. 
              If you do not confirm safety before the buffer expires, all authorized evidence will be automatically emailed to your designated contacts.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleCancelEmergency}
                disabled={cancelling}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <Fingerprint className="w-4 h-4" /> I Am Safe (Cancel Buffer & Reset)
              </button>

              <button
                onClick={handleSimulateEscalation}
                disabled={escalating}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <Play className="w-4 h-4" /> Simulate Buffer Expired (Auto-Release)
              </button>
            </div>
          </div>
        )}

        {/* If in AUTHORIZED_RELEASE */}
        {currentStage === 'AUTHORIZED_RELEASE' && (
          <div className="p-4 rounded-xl bg-cyber-obsidian border border-purple-500/40 space-y-3">
            <div className="text-xs text-purple-300 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              Evidence Disclosure Completed
            </div>
            <p className="text-xs text-cyber-slate-400">
              Your safety buffer expired without check-in. The system automatically decrypted your vault files and transmitted them with attachments to all your verified emergency contacts via Gmail.
            </p>
            <div className="pt-1">
              <button
                onClick={handleCancelEmergency}
                disabled={cancelling}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <Fingerprint className="w-4 h-4" /> Re-Arm Switch & Return to Active
              </button>
            </div>
          </div>
        )}

        {/* If in CHECK_IN_OVERDUE */}
        {currentStage === 'CHECK_IN_OVERDUE' && (
          <div className="p-4 rounded-xl bg-cyber-obsidian border border-cyber-slate-800 flex items-center justify-between">
            <div className="text-xs text-cyber-slate-400">
              Stage: <span className="font-mono text-white font-bold">{currentStage}</span> — Safety notice sent to host email. Entering final buffer.
            </div>
            <button
              onClick={handleSimulateEscalation}
              disabled={escalating}
              className="px-3.5 py-2 rounded-lg bg-cyber-midnight border border-cyan-500/40 text-cyan-300 font-mono text-xs flex items-center gap-2"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Advance to Safety Buffer
            </button>
          </div>
        )}
      </div>

      {/* Stage Transition History Table */}
      <div className="cyber-card p-6 bg-cyber-midnight border-cyber-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          State Machine Transition Audit Trail
        </h3>

        {data?.stageHistory && data.stageHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-cyber-obsidian text-cyber-slate-400 font-mono uppercase text-[11px] border-b border-cyber-slate-800">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Transition</th>
                  <th className="p-3">Trigger</th>
                  <th className="p-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-slate-800/60 font-mono">
                {data.stageHistory.map((item, i) => (
                  <tr key={i} className="hover:bg-cyber-obsidian/40">
                    <td className="p-3 text-cyber-slate-400 whitespace-nowrap">
                      {new Date(item.transitionedAt).toLocaleTimeString()} ({new Date(item.transitionedAt).toLocaleDateString()})
                    </td>
                    <td className="p-3 font-semibold text-white whitespace-nowrap">
                      <span className="text-cyber-slate-400">{item.fromStage}</span> ──►{' '}
                      <span className="text-cyan-400">{item.toStage}</span>
                    </td>
                    <td className="p-3 text-cyber-slate-300 whitespace-nowrap">
                      {item.triggeredBy}
                    </td>
                    <td className="p-3 text-cyber-slate-400 font-sans text-xs">
                      {item.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-cyber-slate-500 font-mono">No stage transitions logged yet.</p>
        )}
      </div>
    </div>
  );
}
