import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Send,
  Trash2,
  RefreshCw,
  Lock,
  Info,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { gmailApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function GmailPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [connection, setConnection] = useState(null);
  const [bannerNotice, setBannerNotice] = useState(null);

  // Test email form state
  const [testForm, setTestForm] = useState({
    recipientEmail: user?.email || '',
    subject: "Dead Man's Switch — Test Transmission Verification",
    message:
      "This is a verified test dispatch from your Dead Man's Switch vault. Your authorized Gmail integration is active and operating under strict send-only permissions.",
  });
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState(null);

  // Disconnect modal state
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Check URL params from OAuth callback
  useEffect(() => {
    const status = searchParams.get('status');
    const email = searchParams.get('email');
    const message = searchParams.get('message');

    if (status === 'success') {
      setBannerNotice({
        type: 'success',
        title: 'Gmail Successfully Connected!',
        text: `Authorized account: ${email}. Encrypted refresh tokens stored securely in vault.`,
      });
      searchParams.delete('status');
      searchParams.delete('email');
      setSearchParams(searchParams, { replace: true });
    } else if (status === 'error' || status === 'denied') {
      setBannerNotice({
        type: 'error',
        title: status === 'denied' ? 'Authorization Cancelled' : 'Connection Failed',
        text: message || 'Google OAuth 2.0 authorization could not be completed.',
      });
      searchParams.delete('status');
      searchParams.delete('message');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch current connection status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await gmailApi.getStatus();
      if (res.data.connected && res.data.connection) {
        setConnection(res.data.connection);
        if (!testForm.recipientEmail) {
          setTestForm((prev) => ({
            ...prev,
            recipientEmail: res.data.connection.gmailAddress || user?.email || '',
          }));
        }
      } else {
        setConnection(null);
      }
    } catch (err) {
      console.error('Failed to load Gmail status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Initiate OAuth flow
  const handleConnect = async () => {
    try {
      setConnecting(true);
      const res = await gmailApi.connect();
      if (res.data.authUrl) {
        // Redirect user to Google OAuth consent screen
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      setBannerNotice({
        type: 'error',
        title: 'Connection Initialization Failed',
        text:
          err.response?.data?.message ||
          'Failed to contact authentication gateway. Please check server configuration.',
      });
      setConnecting(false);
    }
  };

  // Disconnect Gmail
  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      await gmailApi.disconnect();
      setConnection(null);
      setShowDisconnectModal(false);
      setBannerNotice({
        type: 'info',
        title: 'Gmail Disconnected',
        text: 'OAuth authorization revoked and all encrypted tokens purged from system storage.',
      });
    } catch (err) {
      setBannerNotice({
        type: 'error',
        title: 'Disconnection Failed',
        text: err.response?.data?.message || 'Could not disconnect Gmail account.',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  // Send Test Email
  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testForm.recipientEmail) return;

    try {
      setSendingTest(true);
      setTestResult(null);
      setTestError(null);

      const res = await gmailApi.sendTest(testForm);
      setTestResult({
        success: true,
        message: res.data.message,
        messageId: res.data.messageId,
      });
      // Refresh status to update emailsSentCount
      fetchStatus();
    } catch (err) {
      setTestError(
        err.response?.data?.message ||
          'Failed to transmit test email. Please ensure your OAuth token is still valid.'
      );
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-cyber-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyber-primary/10 border border-cyber-primary/30 text-cyber-primary shadow-glow-cyan/20">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Gmail API Gateway
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/20 font-mono font-medium">
                  OAuth 2.0
                </span>
              </h1>
              <p className="text-sm text-cyber-slate-400 mt-0.5">
                Authorize your personal Gmail account to deliver encrypted emergency evidence
              </p>
            </div>
          </div>
        </div>

        {connection && (
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl text-xs font-medium text-cyber-slate-300 hover:text-white bg-cyber-midnight border border-cyber-slate-700/60 hover:border-cyber-primary/50 transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyber-primary' : ''}`} />
            Refresh Status
          </button>
        )}
      </div>

      {/* Banner Notice (OAuth redirect messages) */}
      {bannerNotice && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : bannerNotice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-cyber-primary/10 border-cyber-primary/30 text-cyber-primary'
          }`}
        >
          <div className="flex items-start gap-3">
            {bannerNotice.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            {bannerNotice.type === 'error' && <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            {bannerNotice.type === 'info' && <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <div>
              <div className="font-semibold text-sm">{bannerNotice.title}</div>
              <div className="text-xs opacity-90 mt-0.5">{bannerNotice.text}</div>
            </div>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-xs opacity-70 hover:opacity-100 p-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !connection ? (
        <div className="cyber-card p-12 text-center">
          <RefreshCw className="w-8 h-8 text-cyber-primary animate-spin mx-auto mb-4" />
          <p className="text-cyber-slate-400 text-sm">Querying Gmail OAuth gateway status...</p>
        </div>
      ) : connection ? (
        /* ================= CONNECTED STATE ================= */
        <div className="space-y-6">
          {/* Active Connection Card */}
          <div className="cyber-card p-6 border-emerald-500/30 bg-cyber-midnight relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start sm:items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-glow-cyan/10">
                    <Mail className="w-7 h-7" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500" />
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Active Integration
                    </span>
                    <span className="text-xs text-cyber-slate-400 font-mono">
                      Status: {connection.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2">
                    {connection.gmailAddress}
                  </h2>
                  <p className="text-xs text-cyber-slate-400 mt-0.5">
                    Authorized to dispatch emergency releases via Google Gmail API
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>

            {/* Warning if gmail.send permission is missing */}
            {connection && !connection.scopes?.some((s) => s.includes('gmail.send') || s.includes('mail.google.com')) && (
              <div className="mt-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <div className="font-bold text-sm text-amber-400">Missing Send Permission</div>
                    <div className="mt-0.5 text-cyber-slate-300">
                      You connected your Google account, but the checkbox for <strong>"Send email on your behalf"</strong> was not checked during consent.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 text-xs flex items-center gap-1.5 flex-shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
                  Reconnect & Grant Send Permission
                </button>
              </div>
            )}

            {/* Connection Metrics / Security Specs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-cyber-slate-800/80">
              <div className="bg-cyber-obsidian/60 p-3 rounded-lg border border-cyber-slate-800">
                <div className="text-[11px] font-mono text-cyber-slate-400 uppercase tracking-wider">
                  Granted Scope
                </div>
                <div
                  className={`text-xs font-semibold mt-1 truncate ${
                    connection.scopes?.some((s) => s.includes('gmail.send'))
                      ? 'text-white'
                      : 'text-amber-400'
                  }`}
                  title={connection.scopes?.join(', ')}
                >
                  {connection.scopes?.some((s) => s.includes('gmail.send'))
                    ? 'gmail.send (Send-Only)'
                    : 'Missing Send Scope'}
                </div>
              </div>

              <div className="bg-cyber-obsidian/60 p-3 rounded-lg border border-cyber-slate-800">
                <div className="text-[11px] font-mono text-cyber-slate-400 uppercase tracking-wider">
                  Token Security
                </div>
                <div className="text-xs font-semibold text-cyber-primary mt-1 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> AES-256-GCM
                </div>
              </div>

              <div className="bg-cyber-obsidian/60 p-3 rounded-lg border border-cyber-slate-800">
                <div className="text-[11px] font-mono text-cyber-slate-400 uppercase tracking-wider">
                  Dispatched Count
                </div>
                <div className="text-xs font-semibold text-white mt-1 font-mono">
                  {connection.emailsSentCount || 0} messages
                </div>
              </div>

              <div className="bg-cyber-obsidian/60 p-3 rounded-lg border border-cyber-slate-800">
                <div className="text-[11px] font-mono text-cyber-slate-400 uppercase tracking-wider">
                  Last Activity
                </div>
                <div className="text-xs font-semibold text-white mt-1 truncate">
                  {connection.lastUsedAt
                    ? new Date(connection.lastUsedAt).toLocaleDateString()
                    : 'No dispatches yet'}
                </div>
              </div>
            </div>
          </div>

          {/* Test Transmission Form */}
          <div className="cyber-card p-6 border-cyber-slate-800 bg-cyber-midnight">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-cyber-primary/10 text-cyber-primary border border-cyber-primary/20">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Send Verification Transmission</h3>
                <p className="text-xs text-cyber-slate-400">
                  Verify end-to-end Gmail API dispatching by transmitting an authenticated test email
                </p>
              </div>
            </div>

            {testResult && (
              <div className="mb-5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                <div className="font-semibold flex items-center gap-2 text-sm text-emerald-400 mb-1">
                  <CheckCircle2 className="w-4 h-4" /> Dispatch Successful!
                </div>
                <p>{testResult.message}</p>
                <p className="mt-1 font-mono text-[11px] opacity-80">
                  Google Message ID: {testResult.messageId}
                </p>
              </div>
            )}

            {testError && (
              <div className="mb-5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <div className="font-semibold flex items-center gap-2 text-sm text-rose-400 mb-1">
                  <AlertTriangle className="w-4 h-4" /> Transmission Failed
                </div>
                <p>{testError}</p>
              </div>
            )}

            <form onSubmit={handleSendTest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-cyber-slate-300 mb-1.5 font-mono">
                  Destination Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={testForm.recipientEmail}
                  onChange={(e) =>
                    setTestForm({ ...testForm, recipientEmail: e.target.value })
                  }
                  placeholder="recipient@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cyber-obsidian border border-cyber-slate-700/80 focus:border-cyber-primary text-white text-sm focus:outline-none transition-all placeholder:text-cyber-slate-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-cyber-slate-300 mb-1.5 font-mono">
                  Email Subject
                </label>
                <input
                  type="text"
                  required
                  value={testForm.subject}
                  onChange={(e) =>
                    setTestForm({ ...testForm, subject: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cyber-obsidian border border-cyber-slate-700/80 focus:border-cyber-primary text-white text-sm focus:outline-none transition-all placeholder:text-cyber-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-cyber-slate-300 mb-1.5 font-mono">
                  Message Payload
                </label>
                <textarea
                  rows={3}
                  required
                  value={testForm.message}
                  onChange={(e) =>
                    setTestForm({ ...testForm, message: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cyber-obsidian border border-cyber-slate-700/80 focus:border-cyber-primary text-white text-sm focus:outline-none transition-all placeholder:text-cyber-slate-600 resize-none font-sans"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="cyber-btn-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Dispatching via Gmail API...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Execute Test Dispatch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* ================= NOT CONNECTED STATE ================= */
        <div className="space-y-6">
          {/* Main Onboarding Hero */}
          <div className="cyber-card p-8 text-center relative overflow-hidden bg-cyber-midnight border-cyber-slate-800">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyber-primary/10 via-transparent to-transparent pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-cyber-primary/10 border border-cyber-primary/30 text-cyber-primary mx-auto flex items-center justify-center shadow-glow-cyan/20">
                <Mail className="w-10 h-10" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Connect Your Personal Gmail Account
                </h2>
                <p className="text-cyber-slate-400 text-sm mt-2 leading-relaxed">
                  The Dead Man's Switch sends automated emergency notices to your verified emergency
                  recipients using your own authorized Google account via the official Gmail API.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="cyber-btn-primary px-8 py-3.5 text-sm font-bold uppercase tracking-wider inline-flex items-center gap-3 shadow-glow-cyan"
                >
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Contacting Google OAuth...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Connect With Google OAuth 2.0
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-cyber-slate-400 font-mono">
                Google Cloud Project: <span className="text-cyber-primary font-semibold">deadman-switch-513716</span>
              </p>
            </div>
          </div>

          {/* Security Safeguards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="cyber-card p-5 bg-cyber-midnight border-cyber-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Send-Only Permission</h3>
              <p className="text-xs text-cyber-slate-400 mt-1 leading-relaxed">
                We only request the minimal <code className="text-cyber-primary font-mono text-[11px]">gmail.send</code> scope. We cannot read your inbox, view your emails, or modify your messages.
              </p>
            </div>

            <div className="cyber-card p-5 bg-cyber-midnight border-cyber-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-cyber-primary/10 border border-cyber-primary/30 text-cyber-primary flex items-center justify-center mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">AES-256-GCM Encryption</h3>
              <p className="text-xs text-cyber-slate-400 mt-1 leading-relaxed">
                OAuth refresh tokens are encrypted using hardware-accelerated AES-256-GCM before entering MongoDB. Decryption happens purely in memory.
              </p>
            </div>

            <div className="cyber-card p-5 bg-cyber-midnight border-cyber-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Fail-Closed Architecture</h3>
              <p className="text-xs text-cyber-slate-400 mt-1 leading-relaxed">
                Emails are dispatched strictly when all emergency safeguards, grace periods, and verification checks have been thoroughly satisfied.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card max-w-md w-full p-6 border-rose-500/40 bg-cyber-midnight space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Revoke Gmail Integration?</h3>
                <p className="text-xs text-cyber-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-cyber-slate-300 leading-relaxed">
              Disconnecting will immediately revoke Google OAuth tokens and purge encrypted keys from your vault. Your Dead Man's Switch will no longer be able to transmit emergency notifications until you reconnect.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-cyber-slate-800">
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnecting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-cyber-slate-300 hover:text-white bg-cyber-obsidian border border-cyber-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all flex items-center gap-2 shadow-glow-rose"
              >
                {disconnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Revoking...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Revoke & Purge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
