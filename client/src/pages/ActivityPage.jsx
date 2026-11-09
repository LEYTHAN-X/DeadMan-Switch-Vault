import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Lock,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { auditApi } from '../services/api';

const CATEGORIES = [
  { key: 'ALL', label: 'All Events' },
  { key: 'AUTH', label: 'Authentication' },
  { key: 'EVIDENCE', label: 'Evidence Vault' },
  { key: 'CONTACTS', label: 'Recipients' },
  { key: 'GMAIL', label: 'Gmail API' },
  { key: 'EMERGENCY', label: 'Emergency Engine' },
];

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  // Inspector modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
      };
      if (activeCategory !== 'ALL') {
        params.category = activeCategory;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const [logsRes, statsRes] = await Promise.allSettled([
        auditApi.list(params),
        auditApi.getStats(),
      ]);

      if (logsRes.status === 'fulfilled') {
        setLogs(logsRes.value.data.data || []);
        setPagination(logsRes.value.data.pagination || { total: 0, totalPages: 1, limit: 20 });
      }
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, activeCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleExport = async (format) => {
    try {
      setExporting(true);
      const res = await auditApi.downloadExport(format);
      const blob = new Blob([res.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dms_audit_log_${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const getActionBadge = (action) => {
    if (action.includes('LOGIN_FAILED') || action.includes('DENIED') || action.includes('OVERDUE')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    }
    if (action.includes('EMERGENCY') || action.includes('WARNING')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    if (action.includes('EVIDENCE')) {
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
    if (action.includes('GMAIL')) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-cyber-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Security Audit Trails
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                Append-Only
              </span>
            </h1>
            <p className="text-sm text-cyber-slate-400 mt-0.5">
              Immutable telemetry tracking authentication, vault operations, Gmail dispatches, and emergency workflows
            </p>
          </div>
        </div>

        {/* Export & Refresh Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="px-3.5 py-2 rounded-xl text-xs font-mono font-medium text-cyber-slate-300 hover:text-white bg-cyber-midnight border border-cyber-slate-700 hover:border-cyan-500/50 transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="px-3.5 py-2 rounded-xl text-xs font-mono font-medium text-cyber-slate-300 hover:text-white bg-cyber-midnight border border-cyber-slate-700 hover:border-cyan-500/50 transition-all flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-xl text-cyber-slate-300 hover:text-white bg-cyber-midnight border border-cyber-slate-700"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Telemetry Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="cyber-card p-4 bg-cyber-midnight border-cyber-slate-800">
          <div className="text-[11px] font-mono uppercase text-cyber-slate-400">Total Audit Events</div>
          <div className="text-2xl font-black font-mono text-white mt-1">
            {stats?.totalEvents ?? pagination.total}
          </div>
        </div>

        <div className="cyber-card p-4 bg-cyber-midnight border-cyber-slate-800">
          <div className="text-[11px] font-mono uppercase text-cyber-slate-400">Auth Sessions</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats?.loginsCount || 0}
          </div>
        </div>

        <div className="cyber-card p-4 bg-cyber-midnight border-cyber-slate-800">
          <div className="text-[11px] font-mono uppercase text-cyber-slate-400">Vault Operations</div>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            {stats?.evidenceOpsCount || 0}
          </div>
        </div>

        <div className="cyber-card p-4 bg-cyber-midnight border-cyber-slate-800">
          <div className="text-[11px] font-mono uppercase text-cyber-slate-400">State Transitions</div>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {stats?.emergencyTransitionsCount || 0}
          </div>
        </div>
      </div>

      {/* Controls: Category Tabs & Search Filter */}
      <div className="cyber-card p-5 bg-cyber-midnight border-cyber-slate-800 space-y-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeCategory === cat.key
                  ? 'bg-cyan-500 text-black font-bold shadow-glow-cyan'
                  : 'bg-cyber-obsidian text-cyber-slate-400 border border-cyber-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cyber-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, IP address, or metadata keyword..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cyber-obsidian border border-cyber-slate-700/80 text-white text-xs font-mono focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-cyber-midnight border border-cyber-slate-700 hover:border-cyan-500 text-xs font-mono text-white transition-all"
          >
            Filter
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                fetchLogs();
              }}
              className="px-3 py-2.5 text-xs font-mono text-cyber-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="cyber-card bg-cyber-midnight border-cyber-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-xs text-cyber-slate-400 font-mono">Querying immutable audit records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-cyber-slate-400 text-xs font-mono">
            No audit records match the current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-cyber-obsidian text-cyber-slate-400 font-mono uppercase text-[11px] border-b border-cyber-slate-800">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Security Event Action</th>
                  <th className="p-3.5">Origin IP</th>
                  <th className="p-3.5">Result</th>
                  <th className="p-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-slate-800/60 font-mono">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-cyber-obsidian/40 transition-colors">
                    <td className="p-3.5 text-cyber-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="p-3.5 font-semibold text-white">
                      <span className={`px-2 py-0.5 rounded border text-[11px] ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-cyber-slate-300 flex items-center gap-1.5 whitespace-nowrap">
                      <Globe className="w-3.5 h-3.5 text-cyber-slate-500" />
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {log.success ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS
                        </span>
                      ) : (
                        <span className="text-rose-400 flex items-center gap-1 text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> FAILED
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded bg-cyber-obsidian border border-cyber-slate-700/80 hover:border-cyan-500 text-cyber-slate-300 hover:text-white text-[11px] transition-all inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3 h-3" /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-cyber-slate-800 flex items-center justify-between font-mono text-xs text-cyber-slate-400">
            <div>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded bg-cyber-obsidian border border-cyber-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                className="px-3 py-1.5 rounded bg-cyber-obsidian border border-cyber-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card max-w-lg w-full p-6 border-cyan-500/40 bg-cyber-midnight space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cyber-slate-800">
              <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm font-bold">
                <FileText className="w-4 h-4" />
                Audit Record Inspector
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-cyber-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-cyber-slate-500">Record ID:</span>{' '}
                <span className="text-white">{selectedLog._id}</span>
              </div>
              <div>
                <span className="text-cyber-slate-500">Action:</span>{' '}
                <span className="text-cyan-300 font-bold">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-cyber-slate-500">Timestamp:</span>{' '}
                <span className="text-white">{new Date(selectedLog.createdAt).toISOString()}</span>
              </div>
              <div>
                <span className="text-cyber-slate-500">IP Address:</span>{' '}
                <span className="text-white">{selectedLog.ipAddress}</span>
              </div>
            </div>

            {/* Sanitized Metadata JSON */}
            <div>
              <div className="text-[11px] font-mono text-cyber-slate-400 uppercase mb-1.5">
                Payload Metadata (Sanitized)
              </div>
              <pre className="p-3 rounded-lg bg-cyber-obsidian border border-cyber-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-cyber-slate-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-cyber-obsidian border border-cyber-slate-700 text-xs font-mono text-white hover:border-cyan-500"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
