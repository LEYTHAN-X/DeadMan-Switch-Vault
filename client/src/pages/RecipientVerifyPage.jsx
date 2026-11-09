import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { contactsApi } from '../services/api';
import { ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

export default function RecipientVerifyPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [contactData, setContactData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const executeVerification = async () => {
      try {
        const res = await contactsApi.verify(token);
        setSuccess(true);
        setContactData(res.data?.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Verification token is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      executeVerification();
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-center py-12 px-6 lg:px-8 selection:bg-cyan-500 selection:text-black font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mx-auto shadow-[0_0_20px_rgba(6,182,212,0.2)]">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">
          Recipient Security Verification
        </h2>
        <p className="text-xs text-slate-400 font-mono">
          Cryptographic token confirmation for Digital Dead Man's Switch
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0b0f17] border border-[#151d2f] py-8 px-6 shadow-2xl rounded-2xl sm:px-10 text-center space-y-6">
          {loading ? (
            <div className="py-8 space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-xs font-mono text-slate-400">Verifying cryptographic token...</p>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-mono">
                  Email Address Verified
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  You are now an authenticated trusted recipient for this vault operator.
                </p>
              </div>

              {contactData && (
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-xs font-mono text-slate-300 text-left space-y-1">
                  <p><strong className="text-emerald-400">Recipient:</strong> {contactData.name}</p>
                  <p><strong className="text-emerald-400">Email:</strong> {contactData.email}</p>
                  <p><strong className="text-emerald-400">Status:</strong> VERIFIED</p>
                </div>
              )}

              <p className="text-[11px] text-slate-500 leading-relaxed">
                If the operator ever becomes incapacitated and fail-closed checks pass, pre-authorized encrypted files will be dispatched to your email address.
              </p>

              <Link
                to="/"
                className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-mono font-bold uppercase"
              >
                Learn About DMS <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-950/60 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white font-mono">
                  Verification Failed
                </h3>
                <p className="text-xs text-red-300 font-mono">
                  {error}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Please ask the vault operator to re-send your verification link from their Emergency Contacts dashboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

