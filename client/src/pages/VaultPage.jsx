import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { evidenceApi } from '../services/api';
import { 
  Lock, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  Download, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Search,
  Filter,
  Eye,
  Copy,
  Check
} from 'lucide-react';

export default function VaultPage() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedHash, setCopiedHash] = useState(null);
  const [alertMsg, setAlertMsg] = useState(location.state?.uploaded ? `Evidence "${location.state.title}" successfully encrypted & deposited.` : '');

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const res = await evidenceApi.list();
      setItems(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load evidence items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'image': return ImageIcon;
      case 'video': return Film;
      case 'audio': return Music;
      default: return FileText;
    }
  };

  const handleDownload = async (item) => {
    setDownloadingId(item.id);
    try {
      const res = await evidenceApi.download(item.id);
      
      // Create browser blob download link
      const blob = new Blob([res.data], { type: item.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', item.originalFilename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Decryption download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await evidenceApi.delete(deleteId);
      setItems(items.filter((i) => i.id !== deleteId));
      setDeleteId(null);
      setAlertMsg('Evidence file and GridFS chunks permanently shredded.');
      setTimeout(() => setAlertMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Deletion failed.');
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredItems = items.filter((item) => {
    const matchesCat = filterCategory === 'ALL' || item.fileCategory === filterCategory.toLowerCase();
    const matchesQuery = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.originalFilename.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const totalVaultSize = items.reduce((acc, curr) => acc + (curr.originalSize || 0), 0);

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {alertMsg && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-emerald-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{alertMsg}</span>
          </div>
          <button onClick={() => setAlertMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 p-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#0b0f17] to-[#101623] flex flex-col justify-between space-y-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 text-xs font-mono mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              AES-256-GCM Authenticated Vault
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Lock className="w-6 h-6 text-cyan-400" />
              Encrypted Evidence Vault
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Protected by isolated cryptographic keys and stored in MongoDB GridFS chunks.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/vault/upload"
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" /> Deposit Evidence
            </Link>
            <button
              onClick={fetchEvidence}
              disabled={loading}
              className="p-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-slate-300 hover:text-white text-xs font-mono"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stat: Total Items */}
        <div className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between">
          <span className="text-xs font-mono text-slate-400">Total Encrypted Items</span>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {items.length}
          </div>
          <span className="text-[11px] font-mono text-cyan-400 pt-2 border-t border-[#151d2f]">
            GridFS Chunked & Indexed
          </span>
        </div>

        {/* Stat: Total Storage */}
        <div className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between">
          <span className="text-xs font-mono text-slate-400">Stored Vault Payload</span>
          <div className="text-3xl font-black font-mono text-white mt-2">
            {formatBytes(totalVaultSize)}
          </div>
          <span className="text-[11px] font-mono text-emerald-400 pt-2 border-t border-[#151d2f]">
            SHA-256 Tamper Protected
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or filename..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#1f2a42] bg-[#101623] text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'DOCUMENT', 'IMAGE', 'AUDIO', 'VIDEO'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-mono transition-all uppercase whitespace-nowrap ${
                filterCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-[#101623]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Table */}
      {loading ? (
        <div className="p-16 rounded-2xl border border-[#151d2f] bg-[#0b0f17] text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-xs font-mono text-slate-400">Querying GridFS & Decrypting Metadata Headers...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-16 rounded-2xl border border-dashed border-[#1f2a42] bg-[#0b0f17] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
            <Lock className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white font-mono">Vault Storage Empty</h3>
            <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto">
              Deposit confidential documents, video files, audio recordings, or photographs to be secured.
            </p>
          </div>
          <Link
            to="/vault/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold uppercase transition-all"
          >
            <UploadCloud className="w-4 h-4" /> Deposit First File
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#151d2f] bg-[#0b0f17] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-[#151d2f] bg-[#07090e]/60 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Evidence Record</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Original Size</th>
                  <th className="py-3.5 px-4">SHA-256 Digest</th>
                  <th className="py-3.5 px-4">Deposited</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#151d2f] text-slate-300">
                {filteredItems.map((item) => {
                  const Icon = getCategoryIcon(item.fileCategory);
                  const isDownloading = downloadingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-[#101623]/70 transition-colors">
                      {/* Name & Title */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate max-w-xs">{item.title}</p>
                            <p className="text-[11px] text-slate-500 truncate max-w-xs">{item.originalFilename}</p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono border border-cyan-500/20 bg-cyan-950/30 text-cyan-300">
                          {item.fileCategory}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                        {formatBytes(item.originalSize)}
                      </td>

                      {/* SHA-256 Hash with Copy */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => copyToClipboard(item.sha256Hash)}
                          title="Click to copy full SHA-256 hash"
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#07090e] border border-[#1f2a42] text-[10px] text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30 transition-all font-mono"
                        >
                          <span>{item.sha256Hash.substring(0, 10)}...</span>
                          {copiedHash === item.sha256Hash ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 opacity-60" />
                          )}
                        </button>
                      </td>

                      {/* Upload Date */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Download / Decrypt Button */}
                          <button
                            onClick={() => handleDownload(item)}
                            disabled={isDownloading}
                            title="Decrypt & Download Evidence"
                            className="p-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/50 transition-all flex items-center gap-1 text-[11px] px-2.5"
                          >
                            {isDownloading ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Decrypting...
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" /> Decrypt & Save
                              </>
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteId(item.id)}
                            title="Permanently Shred Evidence"
                            className="p-1.5 rounded-lg border border-red-500/20 bg-red-950/20 text-red-400 hover:bg-red-900/40 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-2xl border border-red-500/30 bg-[#0b0f17] space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-mono">
                Confirm Cryptographic Shredding
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                This will permanently purge the ciphertext chunks from MongoDB GridFS and destroy the decryption records. This operation cannot be reversed.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#1f2a42] text-xs font-mono text-slate-300 hover:bg-[#101623]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
