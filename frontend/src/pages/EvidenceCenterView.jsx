import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  FileText,
  Search,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';

export default function EvidenceCenterView() {
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [copiedHash, setCopiedHash] = useState(null);
  const [expandedHashes, setExpandedHashes] = useState({});

  const loadEvidence = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (typeFilter !== 'ALL') params.type = typeFilter.toLowerCase();
      const data = await api.getEvidence(params);
      setEvidence(data);
    } catch (err) {
      console.error('Failed to load evidence:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, [typeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadEvidence();
  };

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const toggleHash = (id) => {
    setExpandedHashes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filterTabs = [
    { id: 'ALL', label: 'All Evidence' },
    { id: 'VOUCH', label: 'Recommendations' },
    { id: 'DENOUNCEMENT', label: 'Reports' },
    { id: 'CAMPAIGN', label: 'Security Patterns' },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E6DF]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Evidence
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold font-mono border border-indigo-200/60">
              {evidence.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            See the information behind trust decisions.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by contributor, title, or evidence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mg-input pl-9 text-xs"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
          {filterTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                typeFilter === t.id
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Evidence Items Ledger */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 mg-skeleton rounded-2xl" />
          ))}
        </div>
      ) : evidence.length === 0 ? (
        <div className="mg-card p-14 text-center text-xs text-slate-500 bg-white">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-900 text-sm">No evidence records found</p>
          <p className="mt-1 text-slate-500">Try adjusting the filter or search keywords.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E8E6DF] border border-[#E8E6DF] rounded-2xl overflow-hidden bg-white shadow-xs">
          {evidence.map((item) => {
            const isHashOpen = !!expandedHashes[item.id];
            const typeLabel =
              item.type === 'VOUCH'
                ? 'Recommendation'
                : item.type === 'DENOUNCEMENT'
                ? 'Report'
                : 'Security Pattern';

            return (
              <div
                key={item.id}
                className="p-5 text-xs space-y-2.5 hover:bg-[#FAF9F5] transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        item.type === 'VOUCH'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : item.type === 'DENOUNCEMENT'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {typeLabel}
                    </span>
                    <span className="font-bold text-sm text-slate-900">{item.title}</span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono">
                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'verified'}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{item.details}</p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E8E6DF] text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span>Repository: <strong className="text-slate-800 font-semibold">{item.source_project}</strong></span>
                    <span>&bull;</span>
                    <span>Contributor: <strong className="text-indigo-600 font-semibold">@{item.contributor_username}</strong></span>
                  </div>

                  <div className="flex items-center gap-4">
                    {item.provenance_hash && (
                      <button
                        onClick={() => toggleHash(item.id)}
                        className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-mono text-[10px]"
                      >
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>Provenance Details</span>
                        {isHashOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}

                    {item.evidence_url && (
                      <a
                        href={item.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline flex items-center gap-1 font-medium font-sans"
                      >
                        <span>View Pull Request</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {isHashOpen && item.provenance_hash && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-600 flex items-center justify-between gap-2 mt-2">
                    <span className="truncate">Hash: {item.provenance_hash}</span>
                    <button
                      onClick={() => copyHash(item.provenance_hash)}
                      className="text-slate-400 hover:text-slate-700 shrink-0"
                      title="Copy hash"
                    >
                      {copiedHash === item.provenance_hash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
