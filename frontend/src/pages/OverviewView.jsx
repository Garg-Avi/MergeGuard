import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Shield,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  Activity,
  ArrowRight,
  RefreshCw,
  Plus,
  Users,
  ExternalLink,
  Flame,
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';
import { TRUST_STATUSES } from '../utils/statusHelpers';

export default function OverviewView({ onNavigate }) {
  const [data, setData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reviewContributors, setReviewContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [overview, cmps, projs, underReview] = await Promise.all([
        api.getOverview().catch(() => null),
        api.getCampaigns().catch(() => []),
        api.getProjects().catch(() => []),
        api.getContributors({ reputation_state: 'UNDER REVIEW' }).catch(() => []),
      ]);
      setData(overview);
      setCampaigns(cmps || []);
      setProjects(projs || []);
      setReviewContributors(underReview || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-16 w-full rounded-xl bg-[#17191F] border border-[#2B2E35] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="h-24 rounded-xl bg-[#17191F] border border-[#2B2E35] animate-pulse" />
          <div className="h-24 rounded-xl bg-[#17191F] border border-[#2B2E35] animate-pulse" />
          <div className="h-24 rounded-xl bg-[#17191F] border border-[#2B2E35] animate-pulse" />
          <div className="h-24 rounded-xl bg-[#17191F] border border-[#2B2E35] animate-pulse" />
        </div>
        <div className="h-48 rounded-xl bg-[#17191F] border border-[#2B2E35] animate-pulse" />
        <div className="h-64 rounded-xl bg-[#17191F] border border-[#2B2E35] animate-pulse" />
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const dist = data?.reputation_distribution || {};
  const recentActivity = data?.recent_activity || [];

  const totalContributors =
    (dist.ESTABLISHED || 0) +
    (dist.NEWCOMER || 0) +
    (dist.INSUFFICIENT_EVIDENCE || 0) +
    (dist.UNDER_REVIEW || 0) ||
    metrics.tracked_contributors ||
    0;

  const trustedCount = dist.ESTABLISHED || 0;
  const newCount = dist.NEWCOMER || 0;
  const buildingCount = dist.INSUFFICIENT_EVIDENCE || 0;
  const needsReviewCount = dist.UNDER_REVIEW || reviewContributors.length || 0;

  return (
    <div className="space-y-6 animate-fade-in-up font-sans">
      {/* 1. COMPACT DASHBOARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-[#2B2E35]">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#202329] border border-[#2B2E35] text-[11px] font-mono text-[#B0B3BA] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D69B45] animate-pulse" />
              Pull Request Trust Intelligence
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F5F5] tracking-tight mt-1">
            Dashboard Overview
          </h1>
          <p className="text-xs text-[#B0B3BA] mt-0.5">
            Monitor incoming pull requests, contributor reputation status, and coordinated activity across connected repositories.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={() => onNavigate('projects')}
            className="mg-btn-primary text-xs px-3.5 py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Repository</span>
          </button>
          <button
            onClick={() => onNavigate('vouches')}
            className="mg-btn-secondary text-xs px-3.5 py-2"
          >
            <span>Recommend Contributor</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl border border-[#2B2E35] bg-[#17191F] text-[#B0B3BA] hover:text-[#F5F5F5] hover:bg-[#202329] transition-colors shadow-xs"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#D69B45]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. COMPACT, REFINED STATISTIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Your Repositories */}
        <div
          onClick={() => onNavigate('projects')}
          className="mg-card p-4 bg-[#17191F] border border-[#2B2E35] cursor-pointer hover:border-[#383C45] transition-all shadow-xs group rounded-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#777D87] uppercase tracking-wider">
              Connected Repositories
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#202329] border border-[#2B2E35] text-[#777D87] flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderGit2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#F5F5F5] mt-1.5 tracking-tight font-mono">
            {metrics.connected_projects || projects.length}
          </div>
          <p className="text-[11px] text-[#B0B3BA] mt-0.5 truncate">
            Active repositories monitored
          </p>
        </div>

        {/* Tracked Contributors */}
        <div
          onClick={() => onNavigate('contributors')}
          className="mg-card p-4 bg-[#17191F] border border-[#2B2E35] cursor-pointer hover:border-[#383C45] transition-all shadow-xs group rounded-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#777D87] uppercase tracking-wider">
              Tracked Contributors
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#202329] border border-[#2B2E35] text-[#777D87] flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#F5F5F5] mt-1.5 tracking-tight font-mono">
            {totalContributors}
          </div>
          <p className="text-[11px] text-[#B0B3BA] mt-0.5">
            <span className="text-emerald-400 font-semibold">{trustedCount}</span> Trusted &bull; <span className="text-[#B0B3BA] font-semibold">{newCount}</span> Newcomers
          </p>
        </div>

        {/* Contributors Needing Review */}
        <div
          onClick={() => onNavigate('contributors')}
          className={`mg-card p-4 bg-[#17191F] border cursor-pointer transition-all shadow-xs group rounded-xl ${
            needsReviewCount > 0 ? 'border-amber-700/60 hover:border-amber-500' : 'border-[#2B2E35] hover:border-[#383C45]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#777D87] uppercase tracking-wider">
              Requiring Triage
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform ${
              needsReviewCount > 0 ? 'bg-amber-950/70 border border-amber-800/60 text-[#D69B45]' : 'bg-[#202329] border border-[#2B2E35] text-[#777D87]'
            }`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold mt-1.5 tracking-tight font-mono ${
            needsReviewCount > 0 ? 'text-[#D69B45]' : 'text-[#F5F5F5]'
          }`}>
            {needsReviewCount}
          </div>
          <p className="text-[11px] text-[#B0B3BA] mt-0.5 truncate">
            {needsReviewCount > 0 ? 'Pending maintainer investigation' : 'All contributors in good standing'}
          </p>
        </div>

        {/* Verified Recommendations */}
        <div
          onClick={() => onNavigate('vouches')}
          className="mg-card p-4 bg-[#17191F] border border-[#2B2E35] cursor-pointer hover:border-[#383C45] transition-all shadow-xs group rounded-xl"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#777D87] uppercase tracking-wider">
              Verified Vouches
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#202329] border border-[#2B2E35] text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#F5F5F5] mt-1.5 tracking-tight font-mono">
            {metrics.active_vouches || 0}
          </div>
          <p className="text-[11px] text-[#B0B3BA] mt-0.5 truncate">
            Peer recommendations backed by PRs
          </p>
        </div>
      </div>

      {/* 3. SECURITY ALERTS SECTION */}
      <div className="mg-card p-4 sm:p-5 bg-[#17191F] border border-[#2B2E35] rounded-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#F5F5F5] flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>Security &amp; Bot Campaign Radar</span>
            </h2>
            <p className="text-xs text-[#B0B3BA] mt-0.5">
              Real-time heuristic cluster analysis for bot swarms, synchronized PR spikes, and spam templates.
            </p>
          </div>
          <button
            onClick={() => onNavigate('campaigns')}
            className="text-xs font-medium text-[#B0B3BA] hover:text-[#F5F5F5] inline-flex items-center gap-1"
          >
            <span>View Radar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-3.5 rounded-lg bg-[#202329] border border-[#2B2E35] flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-950/70 border border-emerald-800/60 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-[#F5F5F5] block text-xs">No active coordinated campaigns detected</span>
                <span className="text-[11px] text-[#B0B3BA]">Connected repositories exhibit organic, legitimate pull request patterns.</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate('campaigns')}
              className="mg-btn-secondary text-xs py-1.5 px-3 shrink-0"
            >
              Scan Now
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((cmp) => (
              <div
                key={cmp.id}
                className="p-3.5 rounded-lg bg-[#202329] border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-950/80 border border-amber-800/70 text-[#D69B45]">
                      Coordinated Activity
                    </span>
                    <span className="font-bold text-[#F5F5F5]">
                      {cmp.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B0B3BA] leading-relaxed max-w-2xl">
                    {cmp.description || 'Multiple pull requests with identical patterns submitted across repositories in a short time.'}
                  </p>
                  <div className="text-[10px] text-[#777D87] font-mono flex items-center gap-2 pt-0.5">
                    <span>Pattern: {cmp.pattern_type || 'Automated PR Template'}</span>
                    <span>&bull;</span>
                    <span>Similarity: {Math.round((cmp.signal_strength || 0.85) * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('campaigns')}
                  className="mg-btn-secondary text-xs shrink-0 border-amber-700/60 text-[#D69B45] hover:bg-amber-950/50 py-1.5 px-3"
                >
                  Review Alert &rarr;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. REPUTATION DISTRIBUTION & TRUST POLICIES */}
      <div className="mg-card p-4 sm:p-5 bg-[#17191F] border border-[#2B2E35] rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#242730]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#F5F5F5] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#777D87]" />
              <span>Contributor Reputation States</span>
            </h2>
            <p className="text-xs text-[#B0B3BA] mt-0.5">
              Explainable contributor states verified by peer vouches. First-time contributors start with neutral baselines.
            </p>
          </div>
          <button
            onClick={() => onNavigate('contributors')}
            className="text-xs font-medium text-[#B0B3BA] hover:text-[#F5F5F5] inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Contributor Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Trust Status Explanation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Trusted */}
          <div className="p-3 rounded-lg bg-[#202329] border border-[#2B2E35] space-y-1">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TRUST_STATUSES.ESTABLISHED.badgeClass}`}>
                {TRUST_STATUSES.ESTABLISHED.label}
              </span>
              <span className="font-mono font-bold text-[#F5F5F5] text-sm">{trustedCount}</span>
            </div>
            <p className="text-[11px] text-[#B0B3BA] leading-relaxed pt-1">
              {TRUST_STATUSES.ESTABLISHED.description}
            </p>
          </div>

          {/* New */}
          <div className="p-3 rounded-lg bg-[#202329] border border-[#2B2E35] space-y-1">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TRUST_STATUSES.NEWCOMER.badgeClass}`}>
                {TRUST_STATUSES.NEWCOMER.label}
              </span>
              <span className="font-mono font-bold text-[#F5F5F5] text-sm">{newCount}</span>
            </div>
            <p className="text-[11px] text-[#B0B3BA] leading-relaxed pt-1">
              {TRUST_STATUSES.NEWCOMER.description}
            </p>
          </div>

          {/* Building Reputation */}
          <div className="p-3 rounded-lg bg-[#202329] border border-[#2B2E35] space-y-1">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TRUST_STATUSES['INSUFFICIENT EVIDENCE'].badgeClass}`}>
                {TRUST_STATUSES['INSUFFICIENT EVIDENCE'].label}
              </span>
              <span className="font-mono font-bold text-[#F5F5F5] text-sm">{buildingCount}</span>
            </div>
            <p className="text-[11px] text-[#B0B3BA] leading-relaxed pt-1">
              {TRUST_STATUSES['INSUFFICIENT EVIDENCE'].description}
            </p>
          </div>

          {/* Needs Review */}
          <div className="p-3 rounded-lg bg-[#202329] border border-[#2B2E35] space-y-1">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TRUST_STATUSES['UNDER REVIEW'].badgeClass}`}>
                {TRUST_STATUSES['UNDER REVIEW'].label}
              </span>
              <span className="font-mono font-bold text-[#F5F5F5] text-sm">{needsReviewCount}</span>
            </div>
            <p className="text-[11px] text-[#B0B3BA] leading-relaxed pt-1">
              {TRUST_STATUSES['UNDER REVIEW'].description}
            </p>
          </div>
        </div>
      </div>

      {/* 5. RECENT ACTIVITY SECTION */}
      <div className="mg-card p-4 sm:p-5 bg-[#17191F] border border-[#2B2E35] rounded-xl space-y-3.5">
        <div className="flex items-center justify-between pb-3 border-b border-[#242730]">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#F5F5F5] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#777D87]" />
              <span>Recent Activity Feed</span>
            </h2>
            <p className="text-xs text-[#B0B3BA] mt-0.5">
              Verified vouches, incident reports, and pull request audits across your repository network.
            </p>
          </div>
          <button
            onClick={() => onNavigate('admin')}
            className="text-xs font-medium text-[#B0B3BA] hover:text-[#F5F5F5] inline-flex items-center gap-1"
          >
            <span>System Audit Log</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#777D87] space-y-1">
            <Activity className="w-6 h-6 text-[#777D87]/60 mx-auto" />
            <p>No recent activity events recorded yet. Connect a repository to begin monitoring.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#242730]">
            {recentActivity.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex items-start justify-between gap-3 text-xs hover:bg-[#202329] px-2 rounded-lg transition-colors"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 shrink-0">
                    {item.type === 'vouch' ? (
                      <div className="w-5 h-5 rounded-md bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    ) : item.type === 'denouncement' ? (
                      <div className="w-5 h-5 rounded-md bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-[#D69B45]">
                        <AlertTriangle className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-[#B0B3BA]">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#F5F5F5] truncate">
                      {item.description || item.reason || 'Repository Activity Event'}
                    </div>
                    <div className="text-[11px] text-[#B0B3BA] flex items-center gap-2 mt-0.5 flex-wrap">
                      {item.project_name && (
                        <span className="font-mono text-[#F5F5F5] font-medium">{item.project_name}</span>
                      )}
                      {item.contributor && <span>&bull; @{item.contributor}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-[#777D87] font-mono shrink-0 whitespace-nowrap">
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
