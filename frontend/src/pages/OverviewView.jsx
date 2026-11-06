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
  ChevronRight,
  ExternalLink,
  Flame,
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';
import { TRUST_STATUSES, getTrustStatusInfo } from '../utils/statusHelpers';

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
      <div className="space-y-6">
        <div className="mg-skeleton h-24 w-full rounded-2xl" />
        <div className="mg-skeleton h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="mg-skeleton h-32 rounded-2xl" />
          <div className="mg-skeleton h-32 rounded-2xl" />
          <div className="mg-skeleton h-32 rounded-2xl" />
          <div className="mg-skeleton h-32 rounded-2xl" />
        </div>
        <div className="mg-skeleton h-64 rounded-2xl" />
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
    <div className="space-y-8 animate-fade-in-up font-sans">
      {/* 1. WELCOME TO MERGEGUARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E6DF]">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
            <span className="text-xs font-semibold text-indigo-700 tracking-wide uppercase font-mono">
              Pull Request Trust Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Welcome to MergeGuard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            See who is contributing to your code, review recommendations, and keep your pull request queue safe.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => onNavigate('projects')}
            className="mg-btn-primary text-xs shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Repository</span>
          </button>
          <button
            onClick={() => onNavigate('vouches')}
            className="mg-btn-secondary text-xs"
          >
            <span>Recommend Contributor</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-[#DDD9CE] bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-xs"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. CONNECT YOUR REPOSITORY — MOST OBVIOUS STARTING ACTION */}
      <div className="mg-card p-6 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/50 border-indigo-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-semibold">
            <GithubIcon className="w-3.5 h-3.5 text-indigo-700" />
            <span>Quick Start</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            Connect Your Repository
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Connect a public or private GitHub repository to check incoming pull requests and contributor reputations automatically. First-time contributors are welcomed with an open baseline.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('projects')}
            className="mg-btn-primary text-xs px-5 py-2.5 shadow-sm"
          >
            <GithubIcon className="w-4 h-4 text-white" />
            <span>Connect GitHub Repository</span>
          </button>
          <button
            onClick={() => onNavigate('network')}
            className="mg-btn-secondary text-xs px-4 py-2.5"
          >
            <span>Explore Trust Network</span>
          </button>
        </div>
      </div>

      {/* 3. KEY METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Your Repositories */}
        <div
          onClick={() => onNavigate('projects')}
          className="mg-card p-5 bg-white cursor-pointer hover:border-indigo-300 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Your Repositories
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {metrics.connected_projects || projects.length}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Connected repositories under surveillance
          </p>
        </div>

        {/* Your Contributors */}
        <div
          onClick={() => onNavigate('contributors')}
          className="mg-card p-5 bg-white cursor-pointer hover:border-indigo-300 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Your Contributors
            </span>
            <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {totalContributors}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {trustedCount} Trusted &bull; {newCount} New
          </p>
        </div>

        {/* Contributors Needing Review */}
        <div
          onClick={() => onNavigate('contributors')}
          className="mg-card p-5 bg-white cursor-pointer hover:border-amber-300 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Contributors Needing Review
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${
              needsReviewCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-3xl font-extrabold mt-2 ${needsReviewCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
            {needsReviewCount}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {needsReviewCount > 0 ? 'Requires maintainer triage' : 'All contributors in good standing'}
          </p>
        </div>

        {/* Verified Recommendations */}
        <div
          onClick={() => onNavigate('vouches')}
          className="mg-card p-5 bg-white cursor-pointer hover:border-emerald-300 transition-all shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Verified Recommendations
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">
            {metrics.active_vouches || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Peer recommendations backed by PRs
          </p>
        </div>
      </div>

      {/* 4. SECURITY ALERTS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-600" />
              <span>Security Alerts</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Find unusual activity across repositories, such as synchronized bot pull requests.
            </p>
          </div>
          <button
            onClick={() => onNavigate('campaigns')}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View all alerts &rarr;
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div className="mg-card p-6 bg-white flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block text-sm">No security alerts detected</span>
                <span className="text-slate-500">All connected repositories have normal, organic contribution activity.</span>
              </div>
            </div>
            <button
              onClick={() => onNavigate('campaigns')}
              className="mg-btn-secondary text-xs shrink-0"
            >
              Scan Now
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((cmp) => (
              <div
                key={cmp.id}
                className="mg-card p-5 bg-white border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-100 text-amber-800">
                      Unusual Activity Cluster
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {cmp.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                    {cmp.description || 'Multiple pull requests with identical patterns submitted across repositories in a short time.'}
                  </p>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3 pt-1">
                    <span>Pattern: {cmp.pattern_type || 'Automated PR Template'}</span>
                    <span>&bull;</span>
                    <span>Similarity: {Math.round((cmp.signal_strength || 0.85) * 100)}%</span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('campaigns')}
                  className="mg-btn-secondary text-xs shrink-0 border-amber-300 text-amber-900 hover:bg-amber-50"
                >
                  Review Alert &rarr;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. YOUR CONTRIBUTORS & TRUST STATUSES */}
      <div className="mg-card p-6 bg-white space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E8E6DF]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              <span>Your Contributors &amp; Trust Statuses</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Every contributor receives an explainable trust status based on verified work. First-time contributors are never assumed suspicious.
            </p>
          </div>
          <button
            onClick={() => onNavigate('contributors')}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            View Contributor Directory &rarr;
          </button>
        </div>

        {/* Trust Status Explanation Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Trusted */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF] space-y-1">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${TRUST_STATUSES.ESTABLISHED.badgeClass}`}>
                {TRUST_STATUSES.ESTABLISHED.label}
              </span>
              <span className="font-bold text-slate-900 text-sm">{trustedCount}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              {TRUST_STATUSES.ESTABLISHED.description}
            </p>
          </div>

          {/* New */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF] space-y-1">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${TRUST_STATUSES.NEWCOMER.badgeClass}`}>
                {TRUST_STATUSES.NEWCOMER.label}
              </span>
              <span className="font-bold text-slate-900 text-sm">{newCount}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              {TRUST_STATUSES.NEWCOMER.description}
            </p>
          </div>

          {/* Building Reputation */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF] space-y-1">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${TRUST_STATUSES['INSUFFICIENT EVIDENCE'].badgeClass}`}>
                {TRUST_STATUSES['INSUFFICIENT EVIDENCE'].label}
              </span>
              <span className="font-bold text-slate-900 text-sm">{buildingCount}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              {TRUST_STATUSES['INSUFFICIENT EVIDENCE'].description}
            </p>
          </div>

          {/* Needs Review */}
          <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF] space-y-1">
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${TRUST_STATUSES['UNDER REVIEW'].badgeClass}`}>
                {TRUST_STATUSES['UNDER REVIEW'].label}
              </span>
              <span className="font-bold text-slate-900 text-sm">{needsReviewCount}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
              {TRUST_STATUSES['UNDER REVIEW'].description}
            </p>
          </div>
        </div>
      </div>

      {/* 6. RECENT ACTIVITY SECTION */}
      <div className="mg-card p-6 bg-white space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-[#E8E6DF]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <span>Recent Activity</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Recommendations, pull request checks, and contributor events across your repositories.
            </p>
          </div>
          <button
            onClick={() => onNavigate('admin')}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            System Activity Log &rarr;
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <Activity className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No recent activity yet. Connect a repository or recommend a contributor to start tracking.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E8E6DF]">
            {recentActivity.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-start justify-between gap-4 text-xs hover:bg-[#FAF9F5] px-2 rounded-xl transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-0.5 shrink-0">
                    {item.type === 'vouch' ? (
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    ) : item.type === 'denouncement' ? (
                      <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                        <Shield className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {item.description || item.reason || 'Repository Activity Event'}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                      {item.project_name && (
                        <span className="font-mono text-indigo-600 font-medium">{item.project_name}</span>
                      )}
                      {item.contributor && <span>&bull; @{item.contributor}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-mono shrink-0 whitespace-nowrap">
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
