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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2B2E35]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F5F5] tracking-tight">
              Evidence
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#202329] text-[#B0B3BA] font-semibold font-mono border border-[#2B2E35]">
              {evidence.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#B0B3BA] mt-1">
            See the information behind trust decisions.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
          <input
            type="text"
            placeholder="Search by contributor, title, or evidence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mg-input pl-9 text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto text-xs">
          {filterTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                typeFilter === t.id
                  ? 'bg-[#202329] text-[#F5F5F5] font-semibold border border-[#D69B45]/50 shadow-xs'
                  : 'text-[#B0B3BA] hover:text-[#F5F5F5] hover:bg-[#202329]'
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
        <div className="mg-card p-14 text-center text-xs text-[#777D87] bg-[#17191F] border-[#2B2E35]">
          <FileText className="w-10 h-10 text-[#777D87] mx-auto mb-3" />
          <p className="font-bold text-[#F5F5F5] text-sm">No evidence records found</p>
          <p className="mt-1 text-[#777D87]">Try adjusting the filter or search keywords.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#242730] border border-[#2B2E35] rounded-2xl overflow-hidden bg-[#17191F] shadow-xs">
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
                className="p-5 text-xs space-y-2.5 hover:bg-[#202329]/60 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                        item.type === 'VOUCH'
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          : item.type === 'DENOUNCEMENT'
                          ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                          : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                      }`}
                    >
                      {typeLabel}
                    </span>
                    <span className="font-bold text-sm text-[#F5F5F5]">{item.title}</span>
                  </div>

                  <div className="text-[11px] text-[#777D87] font-mono">
                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'verified'}
                  </div>
                </div>

                <p className="text-xs text-[#B0B3BA] leading-relaxed">{item.details}</p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#242730] text-[11px] text-[#777D87]">
                  <div className="flex items-center gap-3">
                    <span>Repository: <strong className="text-[#F5F5F5] font-semibold">{item.source_project}</strong></span>
                    <span>&bull;</span>
                    <span>Contributor: <strong className="text-[#F5F5F5] font-semibold">@{item.contributor_username}</strong></span>
                  </div>

                  <div className="flex items-center gap-4">
                    {item.provenance_hash && (
                      <button
                        onClick={() => toggleHash(item.id)}
                        className="text-[#B0B3BA] hover:text-[#F5F5F5] flex items-center gap-1 font-mono text-[10px]"
                      >
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>Provenance Details</span>
                        {isHashOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}

                    {item.evidence_url && (
                      <a
                        href={item.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#B0B3BA] hover:text-[#F5F5F5] hover:underline flex items-center gap-1 font-medium font-sans"
                      >
                        <span>View Pull Request</span>
                        <ExternalLink className="w-3 h-3 text-[#B0B3BA]" />
                      </a>
                    )}
                  </div>
                </div>

                {isHashOpen && item.provenance_hash && (
                  <div className="p-2.5 rounded-lg bg-[#111318] border border-[#2B2E35] font-mono text-[10px] text-[#B0B3BA] flex items-center justify-between gap-2 mt-2">
                    <span className="truncate">Hash: {item.provenance_hash}</span>
                    <button
                      onClick={() => copyHash(item.provenance_hash)}
                      className="text-[#777D87] hover:text-[#F5F5F5] shrink-0"
                      title="Copy hash"
                    >
                      {copiedHash === item.provenance_hash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
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
