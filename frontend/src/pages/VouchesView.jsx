import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import {
  ShieldCheck,
  Plus,
  ExternalLink,
  Copy,
  Check,
  X,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function VouchesView() {
  const [vouches, setVouches] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copiedHash, setCopiedHash] = useState(null);
  const [expandedHashes, setExpandedHashes] = useState({});

  // Form Fields
  const [formData, setFormData] = useState({
    contributor_username: '',
    source_project_id: '',
    reason: '',
    evidence_url: '',
    context: '',
    confidence: 1.0,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [vList, pList] = await Promise.all([api.getVouches(), api.getProjects()]);
      setVouches(vList);
      setProjects(pList);
      if (pList.length > 0 && !formData.source_project_id) {
        setFormData((prev) => ({ ...prev, source_project_id: pList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.contributor_username.trim()) {
      setErrorMsg('Contributor username is required.');
      return;
    }
    if (!formData.source_project_id) {
      setErrorMsg('Please select a recommending repository.');
      return;
    }
    if (!formData.reason.trim()) {
      setErrorMsg('Recommendation reason is required.');
      return;
    }
    if (!formData.evidence_url.trim().startsWith('http')) {
      setErrorMsg('A valid pull request or commit URL (https://...) is required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.submitVouch({
        ...formData,
        confidence: parseFloat(formData.confidence) || 1.0,
      });

      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.7 },
          colors: ['#4f46e5', '#7c3aed', '#06b6d4'],
        });
      } catch {}

      setSuccessMsg(`Recommendation recorded for @${formData.contributor_username.trim()}`);
      setFormData({
        contributor_username: '',
        source_project_id: projects[0]?.id || '',
        reason: '',
        evidence_url: '',
        context: '',
        confidence: 1.0,
      });
      setShowForm(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit recommendation.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const toggleHash = (id) => {
    setExpandedHashes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 animate-fade-in-up font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2B2E35]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F5F5] tracking-tight">
              Recommendations
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#202329] text-[#B0B3BA] font-semibold font-mono border border-[#2B2E35]">
              {vouches.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#B0B3BA] mt-1">
            Developers can recommend contributors based on verified work.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="mg-btn-primary text-xs self-start sm:self-auto shadow-xs"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'Cancel' : 'Give a Recommendation'}</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-[#777D87] hover:text-[#F5F5F5]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Recommendation Form Accordion */}
      {showForm && (
        <div className="mg-card p-6 bg-[#17191F] border border-[#2B2E35] space-y-4 animate-fade-in-up shadow-md">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#242730]">
            <div className="flex items-center gap-2.5 text-xs font-bold text-[#F5F5F5]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Recommend a Contributor</span>
            </div>
            <button onClick={() => setShowForm(false)} className="text-[#777D87] hover:text-[#F5F5F5]">
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#B0B3BA] font-semibold mb-1.5">Who are you recommending? (GitHub Username) *</label>
                <input
                  type="text"
                  required
                  value={formData.contributor_username}
                  onChange={(e) => setFormData({ ...formData, contributor_username: e.target.value })}
                  placeholder="e.g. elena-rustacean"
                  className="mg-input font-mono text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                />
              </div>

              <div>
                <label className="block text-[#B0B3BA] font-semibold mb-1.5">Recommending Repository *</label>
                <select
                  value={formData.source_project_id}
                  onChange={(e) => setFormData({ ...formData, source_project_id: e.target.value })}
                  className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#B0B3BA] font-semibold mb-1.5">Pull Request URL (Evidence) *</label>
              <input
                type="url"
                required
                value={formData.evidence_url}
                onChange={(e) => setFormData({ ...formData, evidence_url: e.target.value })}
                placeholder="https://github.com/hyperflow-org/hyperflow/pull/412"
                className="mg-input font-mono text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
              />
              <p className="text-[11px] text-[#777D87] mt-1.5">
                Link to an accepted pull request that proves their high-quality work.
              </p>
            </div>

            <div>
              <label className="block text-[#B0B3BA] font-semibold mb-1.5">Reason for Recommendation *</label>
              <textarea
                rows={3}
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g. Elena implemented our asynchronous logging engine with clean tests and clear documentation."
                className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2.5 border-t border-[#242730]">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="mg-btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="mg-btn-primary text-xs"
              >
                {submitting ? 'Submitting...' : 'Submit Recommendation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RECOMMENDATIONS LEDGER */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 mg-skeleton rounded-2xl" />
          ))}
        </div>
      ) : vouches.length === 0 ? (
        <div className="mg-card p-14 text-center text-xs text-[#777D87] bg-[#17191F] border-[#2B2E35]">
          <ShieldCheck className="w-10 h-10 mx-auto text-[#777D87] mb-3" />
          <p className="font-bold text-[#F5F5F5] text-sm">No recommendations recorded yet</p>
          <p className="mt-1 text-[#777D87]">Developers can recommend contributors based on verified work.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#242730] border border-[#2B2E35] rounded-2xl overflow-hidden bg-[#17191F] shadow-xs">
          {vouches.map((v) => {
            const isExpanded = !!expandedHashes[v.id];
            return (
              <div key={v.id} className="p-5 text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:bg-[#202329]/60 transition-colors">
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#F5F5F5]">
                      @{v.contributor_username}
                    </span>
                    <span className="text-[#777D87]">recommended by</span>
                    <span className="font-mono text-xs text-[#B0B3BA] font-semibold bg-[#202329] px-2.5 py-0.5 rounded-md border border-[#2B2E35]">
                      {v.source_project_name || v.source_project_id}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                      Verified
                    </span>
                  </div>

                  <p className="text-xs text-[#B0B3BA] leading-relaxed">
                    {v.reason}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-[#777D87] pt-1 flex-wrap">
                    {v.evidence_url && (
                      <a
                        href={v.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#B0B3BA] hover:text-[#F5F5F5] hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>View Pull Request Evidence</span>
                        <ExternalLink className="w-3 h-3 text-[#B0B3BA]" />
                      </a>
                    )}

                    {v.provenance_hash && (
                      <button
                        onClick={() => toggleHash(v.id)}
                        className="text-[#B0B3BA] hover:text-[#F5F5F5] flex items-center gap-1 font-mono text-[10px]"
                      >
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>Provenance Details</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {isExpanded && v.provenance_hash && (
                    <div className="p-2.5 rounded-lg bg-[#111318] border border-[#2B2E35] font-mono text-[10px] text-[#B0B3BA] flex items-center justify-between gap-2 mt-2">
                      <span className="truncate">Hash: {v.provenance_hash}</span>
                      <button
                        onClick={() => copyHash(v.provenance_hash)}
                        className="text-[#777D87] hover:text-[#F5F5F5] shrink-0"
                        title="Copy hash"
                      >
                        {copiedHash === v.provenance_hash ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-[#777D87] font-mono shrink-0 self-start sm:self-auto">
                  {v.created_at ? new Date(v.created_at).toLocaleDateString() : 'verified'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
