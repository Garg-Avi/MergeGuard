import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  ShieldAlert,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Cpu,
  ChevronDown,
  ChevronUp,
  X,
  FileCode,
  CheckCircle2,
} from 'lucide-react';

export default function CampaignsView() {
  const [campaigns, setCampaigns] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [aiExplanations, setAiExplanations] = useState({});
  const [aiLoading, setAiLoading] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [cmps, anl] = await Promise.all([
        api.getCampaigns(),
        api.getCampaignAnalytics(),
      ]);
      setCampaigns(cmps);
      setAnalytics(anl);
      if (cmps.length > 0 && !expandedId) {
        setExpandedId(cmps[0].id);
      }
    } catch (err) {
      console.error('Failed to load security alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunScan = async () => {
    try {
      setScanning(true);
      setScanMessage(null);
      const res = await api.scanCampaigns();
      setScanMessage(
        res.message ||
          `Scan complete: ${res.campaigns_detected || 0} unusual activity patterns identified across ${res.events_evaluated || 0} pull requests.`
      );
      await loadData();
    } catch (err) {
      console.error('Failed to run scan:', err);
      setScanMessage('Scan error: ' + err.message);
    } finally {
      setScanning(false);
      setTimeout(() => setScanMessage(null), 6000);
    }
  };

  const handleUpdateStatus = async (campaignId, newStatus) => {
    try {
      await api.updateCampaignStatus(campaignId, newStatus);
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status: newStatus } : c))
      );
      const anl = await api.getCampaignAnalytics();
      setAnalytics(anl);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleFetchAIExplanation = async (campaignId) => {
    try {
      setAiLoading((prev) => ({ ...prev, [campaignId]: true }));
      const result = await api.explainWithAI('campaign', campaignId);
      setAiExplanations((prev) => ({ ...prev, [campaignId]: result }));
    } catch (err) {
      console.error('Failed to get explanation:', err);
    } finally {
      setAiLoading((prev) => ({ ...prev, [campaignId]: false }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2B2E35]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F5F5] tracking-tight">
              Security Alerts
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-950/80 text-rose-300 font-semibold font-mono border border-rose-800/40">
              {campaigns.length} Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#B0B3BA] mt-1">
            Find unusual activity across repositories, such as synchronized spam pull requests.
          </p>
        </div>

        <button
          onClick={handleRunScan}
          disabled={scanning}
          className="mg-btn-primary text-xs self-start sm:self-auto shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Scanning Repositories...' : 'Scan for Unusual Activity'}</span>
        </button>
      </div>

      {scanMessage && (
        <div className="p-3.5 rounded-xl bg-[#202329] border border-[#2B2E35] text-xs text-[#B0B3BA] flex items-center justify-between shadow-xs">
          <span>{scanMessage}</span>
          <button onClick={() => setScanMessage(null)} className="text-[#777D87] hover:text-[#F5F5F5]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Analytics Summary */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="mg-card p-4 bg-[#17191F] border border-[#2B2E35] shadow-xs">
            <div className="text-[#777D87] text-[11px] font-medium">Active Alerts</div>
            <div className="text-2xl font-bold text-[#F5F5F5] mt-1">
              {analytics.total_campaigns || campaigns.length}
            </div>
          </div>
          <div className="mg-card p-4 bg-[#17191F] border border-[#2B2E35] shadow-xs">
            <div className="text-[#777D87] text-[11px] font-medium">Under Investigation</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {analytics.status_breakdown?.['Active Investigation'] || 0}
            </div>
          </div>
          <div className="mg-card p-4 bg-[#17191F] border border-[#2B2E35] shadow-xs">
            <div className="text-[#777D87] text-[11px] font-medium">Confirmed Spam</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {analytics.status_breakdown?.['Confirmed Coordinated Abuse'] || 0}
            </div>
          </div>
          <div className="mg-card p-4 bg-[#17191F] border border-[#2B2E35] shadow-xs">
            <div className="text-[#777D87] text-[11px] font-medium">Dismissed</div>
            <div className="text-2xl font-bold text-[#B0B3BA] mt-1">
              {analytics.status_breakdown?.['Dismissed'] || 0}
            </div>
          </div>
        </div>
      )}

      {/* ALERTS LIST */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 mg-skeleton rounded-2xl" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="mg-card p-14 text-center text-xs text-[#777D87] bg-[#17191F] border-[#2B2E35]">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="font-bold text-[#F5F5F5] text-sm">No Unusual Activity Detected</p>
          <p className="mt-1 text-[#777D87]">All pull requests across your connected repositories appear normal and organic.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((cmp) => {
            const isExpanded = expandedId === cmp.id;
            const explanation = aiExplanations[cmp.id];
            const isAiBusy = aiLoading[cmp.id];

            return (
              <div
                key={cmp.id}
                className="mg-card overflow-hidden transition-all bg-[#17191F] border border-[#2B2E35] shadow-xs"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : cmp.id)}
                  className="p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-[#202329]/60 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-amber-950/60 text-amber-400 mt-0.5 shrink-0 border border-amber-800/60">
                      <ShieldAlert className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#F5F5F5]">
                          {cmp.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#111318] text-[#B0B3BA] border border-[#2B2E35] font-mono text-[11px]">
                          {cmp.campaign_code}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          cmp.status === 'Active Investigation'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : cmp.status === 'Confirmed Coordinated Abuse'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                            : 'bg-[#202329] text-[#777D87] border-[#2B2E35]'
                        }`}>
                          {cmp.status}
                        </span>
                      </div>

                      <p className="text-xs text-[#B0B3BA] line-clamp-2 leading-relaxed">
                        {cmp.description}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-[#777D87] pt-1 flex-wrap">
                        <span>Pattern: <strong className="text-[#F5F5F5]">{cmp.pattern_type}</strong></span>
                        <span>&bull;</span>
                        <span>Similarity Match: <strong className="text-[#F5F5F5] font-mono">{Math.round((cmp.signal_strength || 0.85) * 100)}%</strong></span>
                        <span>&bull;</span>
                        <span>Contributors Involved: <strong className="text-[#F5F5F5]">{cmp.contributor_ids?.length || 0}</strong></span>
                      </div>
                    </div>
                  </div>

                  <button className="text-[#777D87] p-1 hover:text-[#F5F5F5] shrink-0 mt-1">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-[#242730] space-y-4 text-xs bg-[#111318]">
                    {/* Pull Request Samples */}
                    {cmp.evidence_records && cmp.evidence_records.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <span className="text-xs font-bold text-[#F5F5F5] block">
                          Sample Pull Requests in this Pattern:
                        </span>
                        <div className="divide-y divide-[#242730] border border-[#2B2E35] rounded-xl overflow-hidden bg-[#17191F]">
                          {cmp.evidence_records.map((ev, eIdx) => (
                            <div key={eIdx} className="p-3 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2 truncate">
                                <FileCode className="w-3.5 h-3.5 text-[#777D87] shrink-0" />
                                <span className="font-semibold text-[#F5F5F5] truncate">
                                  {ev.pr_title || ev.target || `Sample PR #${eIdx + 1}`}
                                </span>
                                {ev.contributor && (
                                  <span className="text-[#777D87] font-mono text-[11px]">by @{ev.contributor}</span>
                                )}
                              </div>
                              {ev.url && (
                                <a
                                  href={ev.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#B0B3BA] hover:text-[#F5F5F5] hover:underline flex items-center gap-1 font-medium text-[11px] shrink-0"
                                >
                                  <span>View PR</span>
                                  <ExternalLink className="w-3 h-3 text-[#B0B3BA]" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Reasoning Summary */}
                    <div className="p-4 rounded-xl bg-[#17191F] border border-[#2B2E35] space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#F5F5F5]">
                          <Cpu className="w-4 h-4 text-[#777D87]" />
                          <span>Forensic Reasoning Summary</span>
                        </div>

                        {!explanation && (
                          <button
                            onClick={() => handleFetchAIExplanation(cmp.id)}
                            disabled={isAiBusy}
                            className="mg-btn-secondary text-xs py-1"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#777D87]" />
                            <span>{isAiBusy ? 'Summarizing...' : 'Summarize Alert'}</span>
                          </button>
                        )}
                      </div>

                      {explanation && (
                        <div className="text-xs text-[#B0B3BA] space-y-2 pt-2 border-t border-[#242730]">
                          <p className="leading-relaxed">{explanation.summary}</p>
                          {Array.isArray(explanation.investigation_checklist) && (
                            <ul className="list-disc pl-4 space-y-1 text-[#777D87]">
                              {explanation.investigation_checklist.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Maintainer Triage Status Buttons */}
                    <div className="pt-3 border-t border-[#242730] flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] text-[#777D87]">Update Alert Status:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateStatus(cmp.id, 'Active Investigation')}
                          className="px-3 py-1 rounded-lg text-xs font-medium border border-amber-800/60 text-amber-300 bg-amber-950/40 hover:bg-amber-900/40 transition-colors"
                        >
                          Investigating
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(cmp.id, 'Confirmed Coordinated Abuse')}
                          className="px-3 py-1 rounded-lg text-xs font-medium border border-rose-800/60 text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 transition-colors"
                        >
                          Confirmed Abuse
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(cmp.id, 'Dismissed')}
                          className="px-3 py-1 rounded-lg text-xs font-medium border border-[#2B2E35] text-[#B0B3BA] bg-[#17191F] hover:bg-[#202329] hover:text-[#F5F5F5] transition-colors"
                        >
                          Dismiss (False Alarm)
                        </button>
                      </div>
                    </div>
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
