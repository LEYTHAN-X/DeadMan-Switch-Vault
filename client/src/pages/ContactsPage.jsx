import React, { useState, useEffect } from 'react';
import { contactsApi, evidenceApi } from '../services/api';
import { 
  Users, 
  UserPlus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Lock, 
  Trash2, 
  Edit3, 
  ShieldCheck, 
  RefreshCw, 
  Copy, 
  Check, 
  FileText, 
  Share2, 
  X,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [vaultItems, setVaultItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [alertMsg, setAlertMsg] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [evidenceModalContact, setEvidenceModalContact] = useState(null);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState([]);
  const [deleteContactId, setDeleteContactId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    relationship: 'Legal Counsel',
    phoneNumber: '',
    notes: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactsRes, vaultRes] = await Promise.all([
        contactsApi.list(),
        evidenceApi.list(),
      ]);
      setContacts(contactsRes.data?.data || []);
      setVaultItems(vaultRes.data?.data || []);
    } catch (err) {
      console.error('Failed to load contacts or evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      email: '',
      relationship: 'Legal Counsel',
      phoneNumber: '',
      notes: '',
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email,
      relationship: contact.relationship,
      phoneNumber: contact.phoneNumber || '',
      notes: contact.notes || '',
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError('');

    const emailTrimmed = (formData.email || '').trim().toLowerCase();
    if (emailTrimmed.endsWith('@gamil.com') || emailTrimmed.endsWith('@gmial.com') || emailTrimmed.endsWith('@yaho.com')) {
      setFormError('Possible email domain typo detected (e.g. @gamil.com). Did you mean @gmail.com or @yahoo.com?');
      setFormSubmitting(false);
      return;
    }

    try {
      if (editingContact) {
        await contactsApi.update(editingContact._id, formData);
        setAlertMsg(`Contact "${formData.name}" updated successfully.`);
      } else {
        const res = await contactsApi.create(formData);
        setAlertMsg(`Contact "${formData.name}" registered. Verification link issued.`);
      }
      setIsAddModalOpen(false);
      await loadData();
      setTimeout(() => setAlertMsg(''), 4000);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Operation failed.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteContactId) return;
    try {
      await contactsApi.delete(deleteContactId);
      setDeleteContactId(null);
      setAlertMsg('Emergency contact removed.');
      await loadData();
      setTimeout(() => setAlertMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    }
  };

  const openEvidenceModal = (contact) => {
    setEvidenceModalContact(contact);
    const currentAssigned = (contact.authorizedEvidence || []).map((e) => (typeof e === 'object' ? e._id : e));
    setSelectedEvidenceIds(currentAssigned);
  };

  const toggleEvidenceSelection = (evidenceId) => {
    if (selectedEvidenceIds.includes(evidenceId)) {
      setSelectedEvidenceIds(selectedEvidenceIds.filter((id) => id !== evidenceId));
    } else {
      setSelectedEvidenceIds([...selectedEvidenceIds, evidenceId]);
    }
  };

  const handleSaveEvidenceAssignment = async () => {
    if (!evidenceModalContact) return;
    try {
      await contactsApi.assignEvidence(evidenceModalContact._id, selectedEvidenceIds);
      setEvidenceModalContact(null);
      setAlertMsg('Evidence authorization mapping updated successfully.');
      await loadData();
      setTimeout(() => setAlertMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Assignment failed.');
    }
  };

  const copyVerificationLink = async (contact) => {
    try {
      const res = await contactsApi.resendVerification(contact._id);
      const link = res.data?.data?.verificationLink;
      if (link) {
        navigator.clipboard.writeText(link);
        setCopiedId(contact._id);
        setTimeout(() => setCopiedId(null), 2500);
      }
    } catch (err) {
      alert('Could not generate verification link.');
    }
  };

  const verifiedCount = contacts.filter((c) => c.verificationStatus === 'VERIFIED').length;
  const pendingCount = contacts.filter((c) => c.verificationStatus === 'PENDING').length;

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
              <ShieldCheck className="w-3.5 h-3.5" />
              Fail-Closed Recipient Authorization
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-cyan-400" />
              Emergency Contacts & Recipients
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Designate trusted contacts, verify email ownership, and map explicit evidence permissions.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openAddModal}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Add Recipient
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-slate-300 hover:text-white text-xs font-mono"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stat: Verified Contacts */}
        <div className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between">
          <span className="text-xs font-mono text-slate-400">Verified Recipients</span>
          <div className="text-3xl font-black font-mono text-emerald-400 mt-2">
            {verifiedCount}
          </div>
          <span className="text-[11px] font-mono text-emerald-400/80 pt-2 border-t border-[#151d2f]">
            Eligible for Emergency Dispatch
          </span>
        </div>

        {/* Stat: Pending Contacts */}
        <div className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between">
          <span className="text-xs font-mono text-slate-400">Pending Verification</span>
          <div className="text-3xl font-black font-mono text-amber-400 mt-2">
            {pendingCount}
          </div>
          <span className="text-[11px] font-mono text-amber-400/80 pt-2 border-t border-[#151d2f]">
            Requires Token Confirmation
          </span>
        </div>
      </div>

      {/* Recipient List / Grid */}
      {loading ? (
        <div className="p-16 rounded-2xl border border-[#151d2f] bg-[#0b0f17] text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-xs font-mono text-slate-400">Loading authorized emergency recipients...</p>
        </div>
      ) : contacts.length === 0 ? (
        <div className="p-16 rounded-2xl border border-dashed border-[#1f2a42] bg-[#0b0f17] text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
            <Users className="w-8 h-8 opacity-70" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white font-mono">No Emergency Recipients Designated</h3>
            <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto">
              Add your lawyer, trusted colleague, journalist, or doctor. Evidence will only ever be dispatched to verified contacts.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold uppercase transition-all"
          >
            <UserPlus className="w-4 h-4" /> Add First Contact
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {contacts.map((contact) => {
            const isVerified = contact.verificationStatus === 'VERIFIED';
            const assignedCount = contact.authorizedEvidence?.length || 0;

            return (
              <div
                key={contact._id}
                className="p-5 rounded-2xl border border-[#151d2f] bg-[#0b0f17] flex flex-col justify-between space-y-4 hover:border-cyan-500/30 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                        {contact.name}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[#1f2a42] bg-[#101623] text-slate-300">
                          {contact.relationship}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{contact.email}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 ${
                      isVerified
                        ? 'border border-emerald-500/30 bg-emerald-950/40 text-emerald-400'
                        : 'border border-amber-500/30 bg-amber-950/40 text-amber-400'
                    }`}
                  >
                    {isVerified ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Verified
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-amber-400" /> Pending
                      </>
                    )}
                  </span>
                </div>

                {/* Evidence Permissions Summary */}
                <div className="p-3 rounded-xl border border-[#151d2f] bg-[#07090e] flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Authorized Vault Items:</span>
                    <strong className="text-cyan-400">{assignedCount} Files</strong>
                  </div>

                  <button
                    onClick={() => openEvidenceModal(contact)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <Share2 className="w-3 h-3" /> Manage Access
                  </button>
                </div>

                {/* Actions Footer */}
                <div className="pt-2 border-t border-[#151d2f] flex items-center justify-between">
                  <div>
                    {!isVerified && (
                      <button
                        onClick={() => copyVerificationLink(contact)}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        {copiedId === contact._id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Link Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy Verification Link
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(contact)}
                      className="p-1.5 rounded-lg border border-[#1f2a42] text-slate-400 hover:text-white hover:bg-[#101623]"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteContactId(contact._id)}
                      className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-950/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full p-6 rounded-2xl border border-cyan-500/30 bg-[#0b0f17] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#151d2f]">
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-cyan-400" />
                {editingContact ? 'Edit Emergency Contact' : 'Register Emergency Recipient'}
              </h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-300 uppercase mb-1">Full Name / Alias</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Attorney Sarah Connor"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-white focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="block text-slate-300 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="sarah@legalcounsel.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-white focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 uppercase mb-1">Relationship</label>
                  <select
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-white focus:outline-none focus:border-cyan-500/60"
                  >
                    <option value="Legal Counsel">Legal Counsel</option>
                    <option value="Investigative Journalist">Investigative Journalist</option>
                    <option value="Immediate Family">Immediate Family</option>
                    <option value="Doctor / Physician">Doctor / Physician</option>
                    <option value="Trusted Colleague">Trusted Colleague</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 uppercase mb-1">Phone (Optional)</label>
                  <input
                    type="text"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+1 555-0100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#1f2a42] bg-[#101623] text-white focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 uppercase mb-1">Confidential Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Special instructions or verification instructions..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#1f2a42] bg-[#101623] text-white focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#1f2a42] text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wider transition-all"
                >
                  {formSubmitting ? 'Saving...' : editingContact ? 'Update Contact' : 'Register Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Granular Evidence Authorization Matrix Modal */}
      {evidenceModalContact && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-xl w-full p-6 rounded-2xl border border-cyan-500/30 bg-[#0b0f17] space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#151d2f]">
              <div>
                <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <Lock className="w-4 h-4 text-cyan-400" />
                  Evidence Access Matrix
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Assigning evidence to: <span className="text-cyan-300">{evidenceModalContact.name}</span>
                </p>
              </div>
              <button onClick={() => setEvidenceModalContact(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 font-mono leading-relaxed">
              Select which encrypted items this recipient is authorized to receive if emergency protocols are triggered.
            </p>

            {vaultItems.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-[#1f2a42] bg-[#07090e] text-center space-y-2">
                <p className="text-xs font-mono text-slate-400">Your vault contains 0 evidence items.</p>
                <p className="text-[11px] font-mono text-slate-500">Deposit evidence in the Evidence Vault first.</p>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {vaultItems.map((item) => {
                  const isChecked = selectedEvidenceIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleEvidenceSelection(item.id)}
                      className={`p-3 rounded-xl border cursor-pointer font-mono text-xs flex items-center justify-between transition-all ${
                        isChecked
                          ? 'border-cyan-500/60 bg-cyan-950/40 text-white'
                          : 'border-[#1f2a42] bg-[#07090e] text-slate-400 hover:bg-[#101623]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Controlled by container onClick
                          className="w-4 h-4 rounded text-cyan-500 bg-[#101623] border-[#1f2a42] focus:ring-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{item.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">{item.originalFilename} • {item.fileCategory}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-400 uppercase font-mono">
                        {isChecked ? 'Authorized' : 'Excluded'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-[#151d2f]">
              <span className="text-xs font-mono text-slate-400">
                Selected: <strong className="text-cyan-400">{selectedEvidenceIds.length}</strong> items
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEvidenceModalContact(null)}
                  className="px-4 py-2 rounded-xl border border-[#1f2a42] text-xs font-mono text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvidenceAssignment}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-mono font-bold uppercase tracking-wider transition-all"
                >
                  Save Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Contact Modal */}
      {deleteContactId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-2xl border border-red-500/30 bg-[#0b0f17] space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-mono">
                Revoke Emergency Recipient
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                This will remove the contact from all evidence release queues and revoke their authorization tokens.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteContactId(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#1f2a42] text-xs font-mono text-slate-300 hover:bg-[#101623]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteContact}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold uppercase tracking-wider"
              >
                Revoke Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
