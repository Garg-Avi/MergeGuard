import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Check,
  X,
  Plus,
} from 'lucide-react';

export default function DenouncementsView() {
  const [denouncements, setDenouncements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Triage state
  const [triagingId, setTriagingId] = useState(null);
  const [triageStatus, setTriageStatus] = useState('Reviewed');
  const [triageNotes, setTriageNotes] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    contributor_username: '',
    reporting_project_id: '',
    reason: '',
    evidence_url: '',
    details: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [dList, pList] = await Promise.all([
        api.getDenouncements(statusFilter !== 'ALL' ? statusFilter : null),
        api.getProjects(),
      ]);
      setDenouncements(dList);
      setProjects(pList);
      if (pList.length > 0 && !formData.reporting_project_id) {
        setFormData((prev) => ({ ...prev, reporting_project_id: pList[0].id }));
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.contributor_username.trim()) {
      setErrorMsg('Contributor username is required.');
      return;
    }
    if (!formData.reporting_project_id) {
      setErrorMsg('Please select a reporting repository.');
      return;
    }
    if (!formData.reason.trim()) {
      setErrorMsg('Report reason is required.');
      return;
    }
    if (!formData.evidence_url.trim().startsWith('http')) {
      setErrorMsg('A valid pull request or evidence URL (https://...) is required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.submitDenouncement(formData);
      setSuccessMsg('Report submitted under "Pending Review". Reports are advisory and require maintainer review.');
      setFormData({
        contributor_username: '',
        reporting_project_id: projects[0]?.id || '',
        reason: '',
        evidence_url: '',
        details: '',
      });
      setShowForm(false);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id) => {
    try {
      await api.updateDenouncementStatus(id, {
        status: triageStatus,
        review_notes: triageNotes,
        reviewed_by: 'maintainer-review',
      });
      setTriagingId(null);
      setTriageNotes('');
      await loadData();
    } catch (err) {
      console.error('Failed to update report status:', err);
    }
  };

  const statusBadges = {
    'Pending Review': 'bg-amber-50 text-amber-800 border-amber-200',
    'Under Investigation': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Reviewed: 'bg-rose-50 text-rose-700 border-rose-200',
    Dismissed: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
  };

  return (
    <div className="space-y-6 animate-fade-in-up font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E6DF]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Reports
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold font-mono border border-rose-200/60">
              {denouncements.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Review concerns raised about contributors.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="mg-btn-primary text-xs self-start sm:self-auto shadow-xs"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{showForm ? 'Cancel' : 'File a Report'}</span>
        </button>
      </div>

      {/* Fairness Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
        <ShieldAlert className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <strong className="font-bold">Fairness First:</strong> Reports are advisory. Contributors are never automatically blocked without maintainer review. All allegations must be backed by verifiable evidence.
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
        {['ALL', 'Pending Review', 'Under Investigation', 'Reviewed', 'Dismissed'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
              statusFilter === tab
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab === 'ALL' ? 'All Reports' : tab}
          </button>
        ))}
      </div>

      {/* Report Form Accordion */}
      {showForm && (
        <div className="mg-card p-6 bg-white space-y-4 animate-fade-in-up shadow-md">
          <div className="flex items-center justify-between pb-3.5 border-b border-[#E8E6DF]">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>File a Report (Evidence Required)</span>
            </div>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Reported Contributor (GitHub Username) *</label>
                <input
                  type="text"
                  required
                  value={formData.contributor_username}
                  onChange={(e) => setFormData({ ...formData, contributor_username: e.target.value })}
                  placeholder="e.g. suspicious-user"
                  className="mg-input font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">Reporting Repository *</label>
                <select
                  value={formData.reporting_project_id}
                  onChange={(e) => setFormData({ ...formData, reporting_project_id: e.target.value })}
                  className="mg-input text-xs"
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
              <label className="block text-slate-700 font-semibold mb-1.5">Pull Request or Incident Link (Evidence) *</label>
              <input
                type="url"
                required
                value={formData.evidence_url}
                onChange={(e) => setFormData({ ...formData, evidence_url: e.target.value })}
                placeholder="https://github.com/org/repo/pull/123"
                className="mg-input font-mono text-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Link to the pull request, commit, or issue where the concern occurred.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Reason for Report *</label>
              <input
                type="text"
                required
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g. Automated AI spam PR copied across multiple repositories"
                className="mg-input text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">Additional Details</label>
              <textarea
                rows={3}
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="Provide helpful context for maintainers reviewing this report..."
                className="mg-input text-xs"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2.5 border-t border-[#E8E6DF]">
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
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REPORTS LIST */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 mg-skeleton rounded-2xl" />
          ))}
        </div>
      ) : denouncements.length === 0 ? (
        <div className="mg-card p-14 text-center text-xs text-slate-500 bg-white">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
          <p className="font-bold text-slate-900 text-sm">No concerns reported</p>
          <p className="mt-1 text-slate-500">All contributors are in good standing.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E8E6DF] border border-[#E8E6DF] rounded-2xl overflow-hidden bg-white shadow-xs">
          {denouncements.map((d) => (
            <div key={d.id} className="p-5 text-xs space-y-3 hover:bg-[#FAF9F5] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900">
                      @{d.contributor_username}
                    </span>
                    <span className="text-slate-500">reported by</span>
                    <span className="font-mono text-xs text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200/50">
                      {d.reporting_project_name || d.reporting_project_id}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadges[d.status] || 'bg-slate-100 text-slate-700'}`}>
                      {d.status}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-900 text-xs mt-1.5">
                    {d.reason}
                  </h4>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <button
                    onClick={() => {
                      setTriagingId(triagingId === d.id ? null : d.id);
                      setTriageStatus(d.status);
                      setTriageNotes(d.review_notes || '');
                    }}
                    className="mg-btn-secondary text-xs py-1"
                  >
                    {triagingId === d.id ? 'Close' : 'Review Status'}
                  </button>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {d.created_at ? new Date(d.created_at).toLocaleDateString() : 'recent'}
                  </span>
                </div>
              </div>

              {d.details && (
                <p className="text-xs text-slate-600 leading-relaxed bg-[#FAF9F5] p-3 rounded-xl border border-[#E8E6DF]/70">
                  {d.details}
                </p>
              )}

              {d.evidence_url && (
                <div className="pt-1">
                  <a
                    href={d.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-medium text-[11px]"
                  >
                    <span>View Pull Request Evidence</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Triage Accordion */}
              {triagingId === d.id && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-fade-in-up mt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">Maintainer Triage</span>
                    <span className="text-[11px] text-slate-500">Update status after investigating</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Status</label>
                      <select
                        value={triageStatus}
                        onChange={(e) => setTriageStatus(e.target.value)}
                        className="mg-input text-xs"
                      >
                        <option value="Pending Review">Pending Review</option>
                        <option value="Under Investigation">Under Investigation</option>
                        <option value="Reviewed">Reviewed</option>
                        <option value="Dismissed">Dismissed (No violation)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Review Notes</label>
                      <input
                        type="text"
                        value={triageNotes}
                        onChange={(e) => setTriageNotes(e.target.value)}
                        placeholder="Resolution or review summary..."
                        className="mg-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => setTriagingId(null)}
                      className="mg-btn-secondary text-xs py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(d.id)}
                      className="mg-btn-primary text-xs py-1"
                    >
                      Save Status
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
