import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { evidenceApi } from '../services/api';
import { 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  ShieldCheck, 
  Lock, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  X,
  FileCheck,
  Fingerprint
} from 'lucide-react';

export default function UploadEvidencePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [releaseRule, setReleaseRule] = useState('ALL_CONTACTS');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectedFile = (selected) => {
    if (selected.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB security maximum.');
      return;
    }
    setError('');
    setFile(selected);
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getIconForType = (mime) => {
    if (mime.startsWith('image/')) return ImageIcon;
    if (mime.startsWith('video/')) return Film;
    if (mime.startsWith('audio/')) return Music;
    return FileText;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select an evidence file to deposit.');
      return;
    }

    setError('');
    setUploading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('releaseRule', releaseRule);

    try {
      await evidenceApi.upload(formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setProgress(percentCompleted);
      });

      navigate('/vault', { state: { uploaded: true, title } });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Evidence upload failed.';
      setError(msg);
      setUploading(false);
    }
  };

  const FileIcon = file ? getIconForType(file.type) : UploadCloud;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            to="/vault"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Evidence Vault
          </Link>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Lock className="w-6 h-6 text-cyan-400" />
            Deposit Encrypted Evidence
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Files are hashed with SHA-256 and encrypted with AES-256-GCM before entering MongoDB GridFS.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Upload Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dropzone */}
        {!file ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_25px_rgba(6,182,212,0.2)]'
                : 'border-[#1f2a42] bg-[#0b0f17] hover:border-cyan-500/40 hover:bg-[#101623]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => e.target.files?.[0] && handleSelectedFile(e.target.files[0])}
              className="hidden"
            />
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto mb-4">
              <UploadCloud className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-sm font-bold text-white font-mono mb-1">
              Drag & Drop confidential files here, or click to browse
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Supports PDF, MP4, MP3, PNG, JPG, WEBM, TXT, DOCX (Up to 50MB)
            </p>
          </div>
        ) : (
          /* Selected File Preview Card */
          <div className="p-5 rounded-2xl border border-cyan-500/30 bg-[#0b0f17] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <FileIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white font-mono">{file.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Size: {formatBytes(file.size)} • Type: {file.type || 'binary/raw'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setFile(null);
                setTitle('');
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/20"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Metadata Details */}
        <div className="p-6 rounded-2xl border border-[#151d2f] bg-[#0b0f17] space-y-4">
          <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Evidence Metadata & Access Parameters
          </h2>

          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
              Evidence Record Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Investigation Deposition Notes"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
              Confidential Case Description / Context
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide background context or instructions regarding these files..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5">
              Emergency Release Authorization Rule
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReleaseRule('ALL_CONTACTS')}
                className={`p-3.5 rounded-xl border text-left font-mono transition-all ${
                  releaseRule === 'ALL_CONTACTS'
                    ? 'border-cyan-500/60 bg-cyan-950/30 text-white'
                    : 'border-[#1f2a42] bg-[#101623] text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold">Transmit to All Verified Contacts</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Sent to all emergency recipients upon full authorization.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReleaseRule('SELECTED_CONTACTS')}
                className={`p-3.5 rounded-xl border text-left font-mono transition-all ${
                  releaseRule === 'SELECTED_CONTACTS'
                    ? 'border-cyan-500/60 bg-cyan-950/30 text-white'
                    : 'border-[#1f2a42] bg-[#101623] text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold">Restrict to Specific Recipients</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Designate individual recipients in Phase 5 Contacts manager.
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-[#0b0f17] space-y-2 font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyan-400 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Encrypting with AES-256-GCM & Uploading to GridFS...
              </span>
              <span className="text-slate-300">{progress}%</span>
            </div>
            <div className="w-full bg-[#101623] h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(6,182,212,0.3)] flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Securing Evidence...
            </>
          ) : (
            <>
              <Fingerprint className="w-4 h-4" /> Encrypt & Deposit into Vault
            </>
          )}
        </button>
      </form>
    </div>
  );
}
