import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Plus,
  X,
  Cpu,
  Clock,
  Sparkles,
  GitPullRequest,
  ChevronDown,
  ChevronUp,
  FolderGit2,
  Shield,
  ArrowUpDown,
  Bot,
  GitMerge,
  TrendingUp,
  RefreshCw,
  ListChecks,
  Code2,
  FileCode,
  MessageSquare,
  Layers,
  ShieldCheck,
  Lock,
  Bug,
} from 'lucide-react';
import { TRUST_STATUSES, getTrustStatusInfo } from '../utils/statusHelpers';

export default function ContributorsView() {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [selectedRepoId, setSelectedRepoId] = useState('ALL');
  const [showDemoProfiles, setShowDemoProfiles] = useState(false);
  const [sortBy, setSortBy] = useState('TRUST_DESC');
  const [selectedContributor, setSelectedContributor] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Phase 2 Deep Evidence-Based Investigation State
  const [evidenceInvestigation, setEvidenceInvestigation] = useState(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [expandedPrId, setExpandedPrId] = useState(null);
  const [evidenceTab, setEvidenceTab] = useState('assessments'); // 'assessments' | 'evidence_timeline'

  // Perspective-based evaluation
  const [projects, setProjects] = useState([]);
  const [viewingProjectId, setViewingProjectId] = useState('');

  // Contributor activity timeline
  const [activityTimeline, setActivityTimeline] = useState([]);

  // Create Contributor Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    username: '',
    display_name: '',
    bio: '',
    skills: '',
    github_url: '',
    avatar_url: '',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');

  const loadContributors = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (stateFilter !== 'ALL') params.reputation_state = stateFilter;
      if (selectedRepoId !== 'ALL') params.project_id = selectedRepoId;
      if (showDemoProfiles) params.include_demo = true;

      const data = await api.getContributors(params);
      setContributors(Array.isArray(data) ? data : (data?.items || []));
    } catch (err) {
      console.error('Failed to load people:', err);
      setContributors([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      const list = Array.isArray(data) ? data : (data?.items || []);
      setProjects(list);
      if (list.length > 0 && !viewingProjectId) {
        setViewingProjectId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
      setProjects([]);
    }
  };

  useEffect(() => {
    loadContributors();
  }, [stateFilter, selectedRepoId, showDemoProfiles]);

  useEffect(() => {
    loadProjects();
  }, []);

  const sortedContributors = useMemo(() => {
    const list = [...(Array.isArray(contributors) ? contributors : [])];
    list.sort((a, b) => {
      if (sortBy === 'TRUST_DESC') {
        const scoreDiff = (b.trust_score ?? 0.5) - (a.trust_score ?? 0.5);
        if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
        const vouchDiff = (b.vouches?.length || b.vouches_count || 0) - (a.vouches?.length || a.vouches_count || 0);
        if (vouchDiff !== 0) return vouchDiff;
        return (b.total_contributions || 0) - (a.total_contributions || 0);
      }
      if (sortBy === 'VOUCHES_DESC') {
        return (b.vouches?.length || b.vouches_count || 0) - (a.vouches?.length || a.vouches_count || 0);
      }
      if (sortBy === 'PR_DESC') {
        return (b.total_contributions || 0) - (a.total_contributions || 0);
      }
      if (sortBy === 'NAME_ASC') {
        return (a.display_name || a.username).localeCompare(b.display_name || b.username);
      }
      return 0;
    });
    return list;
  }, [contributors, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadContributors();
  };

  const handleOpenDetail = (contributor) => {
    setSelectedContributor(contributor);
    setActivityTimeline([]);
    setAiExplanation(null);
    setEvidenceInvestigation(null);
    setEvidenceError('');
    setExpandedPrId(null);
    setEvidenceTab('assessments');
    setShowAdvanced(false);
    const projId = viewingProjectId || (projects[0] ? projects[0].id : null);
    fetchEvaluation(contributor.id, projId);
    fetchActivityTimeline(contributor.id);
    fetchAIExplanation(contributor, projId);
    fetchDeepInvestigation(contributor, false);
  };

  const fetchEvaluation = async (contributorId, projId) => {
    try {
      setEvalLoading(true);
      const evalData = await api.evaluateTrust(contributorId, projId);
      setEvaluation(evalData);
    } catch (err) {
      console.error('Evaluation error:', err);
    } finally {
      setEvalLoading(false);
    }
  };

  const fetchActivityTimeline = async (contributorId) => {
    try {
      const data = await api.getContributorActivity(contributorId);
      const list = Array.isArray(data) ? data : (Array.isArray(data?.timeline) ? data.timeline : []);
      setActivityTimeline(list);
    } catch (err) {
      console.error('Failed to load activity timeline:', err);
      setActivityTimeline([]);
    }
  };

  const handleViewingProjectChange = async (newProjectId) => {
    setViewingProjectId(newProjectId);
    if (selectedContributor) {
      await fetchEvaluation(selectedContributor.id, newProjectId);
      fetchAIExplanation(selectedContributor, newProjectId);
      fetchDeepInvestigation(selectedContributor, false);
    }
  };

  const fetchDeepInvestigation = async (contributor = selectedContributor, forceRefresh = false, prNumber = null) => {
    if (!contributor) return;
    try {
      setEvidenceLoading(true);
      setEvidenceError('');
      const projId = viewingProjectId || (projects[0] ? projects[0].id : null);
      const res = await api.investigateEvidence(contributor.id, projId, prNumber, forceRefresh);
      setEvidenceInvestigation(res);
    } catch (err) {
      console.error('Failed to run deep evidence investigation:', err);
      setEvidenceError(err.message || 'Evidence investigation encountered an error.');
    } finally {
      setEvidenceLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');
    setAddLoading(true);

    try {
      const skillsArray = addForm.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.createContributor({
        username: addForm.username.trim(),
        display_name: addForm.display_name.trim() || addForm.username.trim(),
        bio: addForm.bio.trim(),
        skills: skillsArray,
        github_url: addForm.github_url.trim() || `https://github.com/${addForm.username.trim()}`,
        avatar_url: addForm.avatar_url.trim() || `https://github.com/${addForm.username.trim()}.png`,
      });

      setAddSuccess(`Contributor @${addForm.username} successfully onboarded with a neutral starting status.`);
      setAddForm({
        username: '',
        display_name: '',
        bio: '',
        skills: '',
        github_url: '',
        avatar_url: '',
      });
      setShowAddModal(false);
      await loadContributors();
    } catch (err) {
      setAddError(err.message || 'Failed to add contributor.');
    } finally {
      setAddLoading(false);
    }
  };

  const fetchAIExplanation = async (contributor = selectedContributor, projId = viewingProjectId) => {
    if (!contributor) return;
    try {
      setAiLoading(true);
      const res = await api.explainWithAI('contributor', contributor.id, projId);
      setAiExplanation(res);
    } catch (err) {
      console.error('Failed to fetch AI explanation:', err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2B2E35]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F5F5] tracking-tight">
              People
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#202329] text-[#B0B3BA] font-semibold font-mono border border-[#2B2E35]">
              {contributors.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#B0B3BA] mt-1">
            Developers contributing to your repositories. Filter by repository and inspect verified pull request trust signals.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="mg-btn-primary text-xs self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Contributor</span>
        </button>
      </div>

      {addSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between shadow-xs">
          <span>{addSuccess}</span>
          <button onClick={() => setAddSuccess('')} className="text-[#777D87] hover:text-[#F5F5F5]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username, name, or skill..."
              className="mg-input pl-9 text-xs w-full bg-[#111318] border-[#2B2E35] text-[#F5F5F5] shadow-xs"
            />
          </form>

          {/* Repository Selector Dropdown & Demo Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#B0B3BA] font-medium whitespace-nowrap flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-[#777D87]" />
                <span>Repository:</span>
              </span>
              <select
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                className="mg-input py-1.5 px-3 text-xs w-auto bg-[#111318] border-[#2B2E35] shadow-xs font-medium text-[#F5F5F5]"
              >
                <option value="ALL">All Connected Repositories</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_github_connected ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#B0B3BA] font-medium whitespace-nowrap flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-[#777D87]" />
                <span>Sort:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="mg-input py-1.5 px-3 text-xs w-auto bg-[#111318] border-[#2B2E35] shadow-xs font-medium text-[#F5F5F5]"
              >
                <option value="TRUST_DESC">Highest Trust First</option>
                <option value="VOUCHES_DESC">Most Recommendations</option>
                <option value="PR_DESC">Most Contributions</option>
                <option value="NAME_ASC">Name (A-Z)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#B0B3BA] hover:text-[#F5F5F5] cursor-pointer select-none pl-2 sm:border-l sm:border-[#2B2E35]">
              <input
                type="checkbox"
                checked={showDemoProfiles}
                onChange={(e) => setShowDemoProfiles(e.target.checked)}
                className="rounded border-[#2B2E35] bg-[#111318] text-[#D69B45] focus:ring-[#D69B45] h-3.5 w-3.5"
              />
              <span>Include demo samples</span>
            </label>
          </div>
        </div>

        {/* State Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All People' },
            { id: 'ESTABLISHED', label: TRUST_STATUSES.ESTABLISHED.label },
            { id: 'NEWCOMER', label: TRUST_STATUSES.NEWCOMER.label },
            { id: 'INSUFFICIENT EVIDENCE', label: TRUST_STATUSES['INSUFFICIENT EVIDENCE'].label },
            { id: 'UNDER REVIEW', label: TRUST_STATUSES['UNDER REVIEW'].label },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                stateFilter === tab.id
                  ? 'bg-[#202329] text-[#F5F5F5] font-semibold border border-[#D69B45]/50 shadow-xs'
                  : 'text-[#B0B3BA] hover:text-[#F5F5F5] hover:bg-[#17191F] border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTRIBUTORS DIRECTORY GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 mg-skeleton rounded-2xl" />
          ))}
        </div>
      ) : sortedContributors.length === 0 ? (
        <div className="mg-card p-14 text-center text-xs text-[#777D87] bg-[#17191F] border border-[#2B2E35]">
          <Users className="w-10 h-10 mx-auto text-[#777D87] mb-3" />
          <p className="font-bold text-[#F5F5F5] text-sm">No contributors found</p>
          <p className="mt-1 text-[#B0B3BA]">
            {selectedRepoId !== 'ALL'
              ? 'No pull request contributors found for this repository.'
              : 'Try connecting a GitHub repository or adjusting your search filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedContributors.map((c) => {
            const statusInfo = getTrustStatusInfo(c.reputation_state);
            const scorePct = Math.round((c.trust_score ?? 0.5) * 100);

            return (
              <div
                key={c.id}
                className="mg-card-interactive p-5 flex flex-col justify-between bg-[#17191F] border border-[#2B2E35] text-[#F5F5F5] shadow-xs"
              >
                <div>
                  {/* Contributor Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-[#111318] border border-[#2B2E35] shrink-0">
                        {c.avatar_url ? (
                          <img
                            src={c.avatar_url}
                            alt={c.username}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-xs text-[#777D87]">
                            {c.username.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-sm text-[#F5F5F5] truncate">
                          {c.display_name || c.username}
                        </div>
                        <div className="text-xs text-[#777D87] font-mono truncate">
                          @{c.username}
                        </div>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${statusInfo.badgeClass}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Trust Score Percentage Bar */}
                  <div className="mt-3.5 p-2.5 rounded-xl bg-[#202329] border border-[#2B2E35]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-[#B0B3BA] font-medium flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#777D87]" />
                        <span>Trust Score</span>
                      </span>
                      <span className="font-extrabold text-[#F5F5F5] font-mono text-xs">
                        {scorePct}%
                      </span>
                    </div>
                    <div className="w-full bg-[#111318] rounded-full h-1.5 overflow-hidden border border-[#2B2E35]/50">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          scorePct >= 80
                            ? 'bg-emerald-500'
                            : scorePct >= 50
                            ? 'bg-[#D69B45]'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, scorePct))}%` }}
                      />
                    </div>
                  </div>

                  {/* Connected Repository Badges */}
                  {c.repositories && c.repositories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                      {c.repositories.map((repo, rIdx) => (
                        <span
                          key={rIdx}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono bg-[#202329] text-[#B0B3BA] border border-[#2B2E35] font-semibold"
                          title={`Contributed to repository ${repo.name}`}
                        >
                          <FolderGit2 className="w-3 h-3 text-[#777D87] shrink-0" />
                          <span className="truncate max-w-[150px]">{repo.name}</span>
                          {repo.pr_count > 0 && (
                            <span className="text-[10px] text-[#B0B3BA] font-bold">
                              ({repo.pr_count} PR{repo.pr_count > 1 ? 's' : ''})
                            </span>
                          )}
                        </span>
                      ))}
                      {c.is_demo && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#202329] text-[#777D87] border border-[#2B2E35]">
                          Demo Sample
                        </span>
                      )}
                    </div>
                  )}

                  {/* Bio */}
                  {c.bio && (
                    <p className="text-xs text-[#B0B3BA] mt-2.5 line-clamp-2 leading-relaxed">
                      {c.bio}
                    </p>
                  )}

                  {/* Skills tags */}
                  {c.skills && c.skills.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {c.skills.slice(0, 3).map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]"
                        >
                          {skill}
                        </span>
                      ))}
                      {c.skills.length > 3 && (
                        <span className="text-[10px] text-[#777D87] self-center">
                          +{c.skills.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="mt-4 pt-3 border-t border-[#2B2E35] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-emerald-400 font-medium flex items-center gap-1" title="Verified Recommendations">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{c.vouches?.length || c.vouches_count || 0} Recommended</span>
                    </span>
                    {(c.denouncements?.length || c.allegations_count || 0) > 0 && (
                      <span className="text-amber-400 font-medium flex items-center gap-1" title="Reports under review">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{c.denouncements?.length || c.allegations_count} Reported</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenDetail(c)}
                    className="mg-btn-secondary text-xs py-1 px-3"
                  >
                    <span>View Profile</span>
                    <ArrowRight className="w-3 h-3 text-[#777D87]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL (Rendered into document.body via Portal) */}
      {selectedContributor && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedContributor(null)}
        >
          <div className="flex min-h-full items-center justify-center p-3 sm:p-6 text-center">
            <div
              className="relative w-full max-w-4xl bg-[#17191F] text-[#F5F5F5] rounded-2xl shadow-2xl border border-[#2B2E35] flex flex-col max-h-[92vh] overflow-hidden text-left animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[#111318] px-6 py-4 border-b border-[#2B2E35] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-[#111318] border border-[#2B2E35] shrink-0">
                    <img
                      src={selectedContributor.avatar_url || `https://github.com/${selectedContributor.username}.png`}
                      alt={selectedContributor.username}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-[#F5F5F5] truncate">
                        {selectedContributor.display_name || selectedContributor.username}
                      </h3>
                      {(() => {
                        const st = getTrustStatusInfo(selectedContributor.reputation_state);
                        return (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${st.badgeClass}`}>
                            {st.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-xs text-[#777D87] font-mono flex items-center gap-2 mt-0.5">
                      <span>@{selectedContributor.username}</span>
                      {selectedContributor.github_url && (
                        <a
                          href={selectedContributor.github_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#B0B3BA] hover:text-[#F5F5F5] hover:underline flex items-center gap-1 font-sans"
                        >
                          <ExternalLink className="w-3 h-3 text-[#B0B3BA]" />
                          <span>GitHub</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedContributor(null)}
                  className="p-1.5 text-[#777D87] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202329] transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#17191F]">
                {/* Status Explanation Card */}
                <div className="p-3.5 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#D69B45] mt-1.5 shrink-0" />
                  <div className="text-xs text-[#B0B3BA] leading-relaxed">
                    <span className="font-bold text-[#F5F5F5] mr-1.5">
                      {getTrustStatusInfo(selectedContributor.reputation_state).label}:
                    </span>
                    {getTrustStatusInfo(selectedContributor.reputation_state).description}
                  </div>
                </div>

                {/* Perspective Viewpoint Selector */}
                <div className="p-3.5 rounded-xl bg-[#202329] border border-[#2B2E35] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="block font-bold text-[#F5F5F5]">
                      Evaluating From Repository Perspective
                    </span>
                    <span className="text-[11px] text-[#B0B3BA] block">
                      Choose which connected repository evaluates this contributor's trust score.
                    </span>
                  </div>

                  <select
                    value={viewingProjectId}
                    onChange={(e) => handleViewingProjectChange(e.target.value)}
                    className="mg-input py-1 px-2.5 text-xs sm:w-56 bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Evaluation Score Card */}
                {evalLoading ? (
                  <div className="p-8 text-center text-xs text-[#777D87]">
                    Checking contributor trust signals...
                  </div>
                ) : evaluation ? (
                  <div className="mg-card p-4 space-y-3.5 bg-[#202329] border border-[#2B2E35] shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-[#B0B3BA] font-medium">Trust Score</div>
                        <div className="text-2xl font-black text-[#F5F5F5] mt-0.5 font-mono">
                          {(evaluation.trust_confidence * 100).toFixed(0)}%
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-[#B0B3BA] font-medium">Assigned Status</div>
                        <div className="mt-1">
                          {(() => {
                            const evalSt = getTrustStatusInfo(evaluation.reputation_state);
                            return (
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${evalSt.badgeClass}`}>
                                {evalSt.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Confidence Bar */}
                    <div className="h-2 w-full rounded-full bg-[#111318] overflow-hidden border border-[#2B2E35]/60">
                      <div
                        style={{ width: `${Math.min(100, Math.max(8, evaluation.trust_confidence * 100))}%` }}
                        className={`h-full transition-all duration-500 ${
                          evaluation.reputation_state === 'ESTABLISHED'
                            ? 'bg-emerald-500'
                            : evaluation.reputation_state === 'UNDER REVIEW'
                            ? 'bg-amber-500'
                            : 'bg-[#D69B45]'
                        }`}
                      />
                    </div>

                    {/* Plain Language Evaluation Notes */}
                    {evaluation.summary_explanation && (
                      <div className="p-3 rounded-xl bg-[#17191F] border border-[#2B2E35] text-xs text-[#B0B3BA]">
                        <div className="text-[10px] font-bold text-[#777D87] uppercase tracking-wider mb-1">
                          HOW THIS WAS EVALUATED
                        </div>
                        <p className="leading-relaxed text-[#F5F5F5]">{evaluation.summary_explanation}</p>
                      </div>
                    )}

                    {/* Expandable Technical Details */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs text-[#B0B3BA] hover:text-[#F5F5F5] font-medium flex items-center gap-1"
                      >
                        <span>{showAdvanced ? 'Hide technical calculation details' : 'Show technical calculation details'}</span>
                        {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {showAdvanced && (
                        <div className="mt-2.5 p-3 rounded-xl bg-[#111318] border border-[#2B2E35] text-xs space-y-2.5 font-mono">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div>
                              <span className="text-[#777D87] block">Direct Recommendations</span>
                              <span className="font-bold text-emerald-400">+{evaluation.effective_vouch_weight?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div>
                              <span className="text-[#777D87] block">Reports Weight</span>
                              <span className="font-bold text-rose-400">-{evaluation.effective_denounce_weight?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div>
                              <span className="text-[#777D87] block">Newcomer Baseline</span>
                              <span className="font-bold text-[#F5F5F5]">{evaluation.newcomer_fairness_applied ? 'Applied' : 'Exceeded'}</span>
                            </div>
                            <div>
                              <span className="text-[#777D87] block">Conflicting Signals</span>
                              <span className="font-bold text-[#F5F5F5]">{evaluation.conflicting_signals_detected ? 'Yes' : 'No'}</span>
                            </div>
                          </div>

                          {evaluation.applied_policy_rules && evaluation.applied_policy_rules.length > 0 && (
                            <div className="pt-2 border-t border-[#2B2E35]">
                              <span className="text-[10px] text-[#777D87] block uppercase font-sans font-semibold mb-1">Applied Policy Rules:</span>
                              <ul className="list-disc pl-4 space-y-0.5 text-[#B0B3BA] text-[11px]">
                                {(evaluation.applied_policy_rules || []).map((r, rIdx) => (
                                  <li key={rIdx}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Phase 2: Evidence-Based AI Contributor Investigation */}
                <div className="mg-card p-4 sm:p-5 space-y-4 bg-[#17191F] border border-[#2B2E35] shadow-xs relative overflow-hidden">
                  {/* Header banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2B2E35]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#202329] border border-[#2B2E35] text-[#D69B45] flex items-center justify-center shadow-xs shrink-0">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[#F5F5F5]">
                            Evidence-Based AI Investigation
                          </span>
                          {evidenceInvestigation?.metadata?.execution_mode === 'LIVE_INFERENCE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Groq (openai/gpt-oss-120b) Connected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                              <Shield className="w-3 h-3 text-amber-400" />
                              Deterministic Rules Fallback
                            </span>
                          )}
                          {evidenceInvestigation?.metadata?.latency_ms && (
                            <span className="text-[10px] text-[#777D87] font-mono">
                              {(evidenceInvestigation.metadata.latency_ms / 1000).toFixed(2)}s latency
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#B0B3BA] mt-0.5">
                          Deep public GitHub cross-repository audit with code diff inspection, test coverage analysis, and review triage
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => fetchDeepInvestigation(selectedContributor, true)}
                      disabled={evidenceLoading}
                      className="mg-btn-secondary text-xs py-1.5 px-3 self-start sm:self-auto shrink-0 font-medium shadow-xs"
                      title="Refresh evidence from GitHub and re-run GPT-OSS-120B analysis"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${evidenceLoading ? 'animate-spin text-[#D69B45]' : 'text-[#777D87]'}`} />
                      <span>{evidenceLoading ? 'Auditing GitHub...' : 'Refresh Evidence & Re-run'}</span>
                    </button>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex items-center gap-2 border-b border-[#2B2E35] pb-2 text-xs font-medium">
                    <button
                      onClick={() => setEvidenceTab('assessments')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                        evidenceTab === 'assessments'
                          ? 'bg-[#202329] text-[#F5F5F5] font-semibold border border-[#D69B45]/50'
                          : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#777D87]" />
                      <span>Three Independent AI Assessments</span>
                    </button>
                    <button
                      onClick={() => setEvidenceTab('evidence_timeline')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                        evidenceTab === 'evidence_timeline'
                          ? 'bg-[#202329] text-[#F5F5F5] font-semibold border border-[#D69B45]/50'
                          : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5 text-[#777D87]" />
                      <span>
                        Public PR Evidence &amp; Diffs ({evidenceInvestigation?.pr_records?.length || 0})
                      </span>
                    </button>
                  </div>

                  {/* Loading State */}
                  {evidenceLoading && !evidenceInvestigation && (
                    <div className="p-8 text-center text-xs text-[#B0B3BA] space-y-3 bg-[#202329] rounded-xl border border-[#2B2E35]">
                      <RefreshCw className="w-6 h-6 text-[#D69B45] animate-spin mx-auto" />
                      <p className="font-semibold text-[#F5F5F5] text-sm">
                        Conducting Evidence Investigation with GPT-OSS-120B...
                      </p>
                      <p className="text-[11px] text-[#B0B3BA] max-w-md mx-auto">
                        Searching public GitHub repositories, retrieving code diffs and review discussions, and performing multi-dimensional engineering assessment.
                      </p>
                    </div>
                  )}

                  {/* Error Banner */}
                  {evidenceError && (
                    <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center justify-between">
                      <span>{evidenceError}</span>
                      <button
                        onClick={() => fetchDeepInvestigation(selectedContributor, true)}
                        className="text-xs font-bold underline ml-2 hover:text-rose-200"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                {/* Loaded Content */}
                {evidenceInvestigation && (
                  <div className="space-y-4">
                    {/* TAB 1: THREE INDEPENDENT ASSESSMENTS */}
                    {evidenceTab === 'assessments' && (
                      <div className="space-y-4">
                        {/* CARD A: CONTRIBUTOR BACKGROUND ASSESSMENT */}
                        <div className="p-4 rounded-xl bg-[#202329] border border-[#2B2E35] space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B0B3BA]">
                                  Assessment A: Contributor Background &amp; Engineering Quality
                                </span>
                              </div>
                              <p className="text-xs text-[#B0B3BA] mt-0.5">
                                Evaluated from historical pull requests and real code diffs across public GitHub repositories
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[10px] uppercase font-bold text-[#777D87] block">Quality Rating</span>
                              {evidenceInvestigation.background_assessment?.is_insufficient_evidence ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#17191F] text-[#B0B3BA] border border-[#2B2E35]">
                                  Neutral (No Diffs)
                                </span>
                              ) : (
                                <span className="text-xl font-black text-[#F5F5F5] font-mono">
                                  {Math.round((evidenceInvestigation.background_assessment?.engineering_quality_rating ?? 0.5) * 100)}%
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Rubric Breakdown Chips */}
                          {evidenceInvestigation.background_assessment?.rubric_breakdown && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                              <div className="p-2 rounded-lg bg-[#17191F] border border-[#2B2E35] text-xs">
                                <span className="text-[10px] text-[#777D87] block font-medium">Correctness</span>
                                <span className="font-bold text-[#F5F5F5] font-mono text-[11px]">
                                  {Math.round((evidenceInvestigation.background_assessment.rubric_breakdown.code_correctness ?? evidenceInvestigation.background_assessment.rubric_breakdown.code_structure ?? 0.5) * 100)}%
                                </span>
                              </div>
                              <div className="p-2 rounded-lg bg-[#17191F] border border-[#2B2E35] text-xs">
                                <span className="text-[10px] text-[#777D87] block font-medium">Maintainability</span>
                                <span className="font-bold text-[#F5F5F5] font-mono text-[11px]">
                                  {Math.round((evidenceInvestigation.background_assessment.rubric_breakdown.maintainability ?? 0.5) * 100)}%
                                </span>
                              </div>
                              <div className="p-2 rounded-lg bg-[#17191F] border border-[#2B2E35] text-xs">
                                <span className="text-[10px] text-[#777D87] block font-medium">Test Discipline</span>
                                <span className="font-bold text-[#F5F5F5] font-mono text-[11px]">
                                  {Math.round((evidenceInvestigation.background_assessment.rubric_breakdown.test_discipline ?? evidenceInvestigation.background_assessment.rubric_breakdown.test_coverage ?? 0.5) * 100)}%
                                </span>
                              </div>
                              <div className="p-2 rounded-lg bg-[#17191F] border border-[#2B2E35] text-xs">
                                <span className="text-[10px] text-[#777D87] block font-medium">Complexity</span>
                                <span className="font-bold text-[#F5F5F5] font-mono text-[11px]">
                                  {Math.round((evidenceInvestigation.background_assessment.rubric_breakdown.technical_complexity ?? 0.5) * 100)}%
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Narrative Summary */}
                          <p className="text-xs text-[#F5F5F5] leading-relaxed font-medium">
                            {evidenceInvestigation.background_assessment?.summary}
                          </p>

                          {/* Consistency & Testing Habits */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#B0B3BA] pt-1 border-t border-[#2B2E35]">
                            <div>
                              <span className="font-bold text-[#F5F5F5] block">Historical Consistency:</span>
                              <span>{evidenceInvestigation.background_assessment?.historical_consistency || evidenceInvestigation.background_assessment?.consistency_analysis}</span>
                            </div>
                            <div>
                              <span className="font-bold text-[#F5F5F5] block">Testing &amp; Quality Habits:</span>
                              <span>{evidenceInvestigation.background_assessment?.testing_habits || evidenceInvestigation.background_assessment?.complexity_assessment}</span>
                            </div>
                          </div>

                          {/* Technical Strengths & Recurring Weaknesses */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#2B2E35] text-xs">
                            {/* Strengths */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Observed Technical Strengths</span>
                              </span>
                              <ul className="space-y-1 text-[#B0B3BA] text-[11px]">
                                {((evidenceInvestigation.background_assessment?.technical_strengths?.length > 0)
                                  ? evidenceInvestigation.background_assessment.technical_strengths
                                  : (evidenceInvestigation.background_assessment?.positive_engineering_signals || [])).map((sig, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-emerald-400 font-bold shrink-0">&bull;</span>
                                    <span>{sig}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Weaknesses / Concerns */}
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                <span>Recurring Technical Concerns</span>
                              </span>
                              <ul className="space-y-1 text-[#B0B3BA] text-[11px]">
                                {((evidenceInvestigation.background_assessment?.recurring_weaknesses?.length > 0)
                                  ? evidenceInvestigation.background_assessment.recurring_weaknesses
                                  : (evidenceInvestigation.background_assessment?.potential_technical_concerns || [])).map((con, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-amber-400 font-bold shrink-0">&bull;</span>
                                    <span>{con}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* CARD B: CURRENT PR ASSESSMENT & LINE-BY-LINE REVIEW */}
                        <div className="p-4 rounded-xl bg-[#17191F] border border-[#2B2E35] shadow-xs space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B0B3BA]">
                                  Assessment B: Current PR Code Evaluation &amp; Diff Findings
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-[#F5F5F5] mt-0.5">
                                {evidenceInvestigation.current_pr_assessment?.title ? (
                                  <span>
                                    #{evidenceInvestigation.current_pr_assessment.pr_number} {evidenceInvestigation.current_pr_assessment.title} ({evidenceInvestigation.current_pr_assessment.repo_name})
                                  </span>
                                ) : (
                                  <span className="text-[#777D87]">Representative PR Code Review</span>
                                )}
                              </div>
                            </div>

                            {/* Verdict Badge */}
                            <div>
                              {(() => {
                                const v = evidenceInvestigation.current_pr_assessment?.verdict;
                                let badge = 'bg-[#202329] text-slate-300 border-[#2B2E35]';
                                if (v === 'READY_TO_MERGE') badge = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60';
                                else if (v === 'LOW_RISK') badge = 'bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]';
                                else if (v === 'NEEDS_REVISION') badge = 'bg-amber-950/60 text-amber-300 border-amber-800/60';
                                else if (v === 'INSUFFICIENT_TESTS') badge = 'bg-orange-950/60 text-orange-300 border-orange-800/60';
                                else if (v === 'SECURITY_TRIAGE_RECOMMENDED') badge = 'bg-rose-950/60 text-rose-300 border-rose-800/60';
                                return (
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${badge}`}>
                                    {v || 'REVIEW_PENDING'}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>

                          {evidenceInvestigation.current_pr_assessment?.overall_summary && (
                            <p className="text-xs text-[#F5F5F5] leading-relaxed font-medium">
                              {evidenceInvestigation.current_pr_assessment.overall_summary}
                            </p>
                          )}

                          {/* Specific Line-by-Line Code Findings */}
                          {evidenceInvestigation.current_pr_assessment?.code_issues?.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-[#2B2E35]">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-[#F5F5F5]">
                                <Bug className="w-4 h-4 text-rose-400" />
                                <span>Specific Line-by-Line Code Findings ({evidenceInvestigation.current_pr_assessment.code_issues.length}):</span>
                              </div>
                              <div className="space-y-2">
                                {(evidenceInvestigation.current_pr_assessment.code_issues || []).map((iss, iIdx) => {
                                  const isHigh = iss.severity === 'HIGH';
                                  const isMed = iss.severity === 'MEDIUM';
                                  const sevClass = isHigh
                                    ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                                    : isMed
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                                    : 'bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]';
                                  return (
                                    <div key={iIdx} className="p-3 rounded-lg border border-[#2B2E35] bg-[#202329] text-xs space-y-1.5 shadow-2xs">
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#F5F5F5]">
                                          <FileCode className="w-3.5 h-3.5 text-[#777D87] shrink-0" />
                                          <span>{iss.file}</span>
                                          {iss.line && <span className="text-[#B0B3BA]">:{iss.line}</span>}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${sevClass}`}>
                                            {iss.severity}
                                          </span>
                                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#17191F] text-[#B0B3BA] border border-[#2B2E35]">
                                            {iss.issue_type}
                                          </span>
                                        </div>
                                      </div>
                                      <p className="text-[#B0B3BA] text-[11px] leading-relaxed">{iss.description}</p>
                                      {iss.suggested_fix && (
                                        <div className="p-2 rounded bg-[#202329] border border-[#2B2E35] text-[11px] text-[#B0B3BA] font-mono">
                                          <span className="font-bold">Suggested Fix: </span>
                                          <span>{iss.suggested_fix}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* File-by-File Analysis Breakdown */}
                          {evidenceInvestigation.current_pr_assessment?.file_analyses?.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-[#2B2E35]">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-[#F5F5F5]">
                                <Layers className="w-4 h-4 text-[#777D87]" />
                                <span>File-by-File Engineering Analysis ({evidenceInvestigation.current_pr_assessment.file_analyses.length}):</span>
                              </div>
                              <div className="space-y-1.5">
                                {(evidenceInvestigation.current_pr_assessment.file_analyses || []).map((fa, fIdx) => (
                                  <div key={fIdx} className="p-2.5 rounded-lg border border-[#2B2E35] bg-[#202329] text-xs space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-mono font-bold text-[#F5F5F5] text-[11px] truncate">{fa.filename}</span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="font-mono text-[10px] text-[#B0B3BA]">+{fa.additions}/-{fa.deletions}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono border ${
                                          fa.risk_level === 'HIGH' ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' :
                                          fa.risk_level === 'MEDIUM' ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' :
                                          'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                        }`}>
                                          {fa.risk_level} RISK
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-[#B0B3BA] text-[11px]">{fa.logic_analyzed}</p>
                                    {fa.security_and_bugs_notes && (
                                      <p className="text-[10px] text-[#777D87] italic">Security: {fa.security_and_bugs_notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Test Suites Detected */}
                          {evidenceInvestigation.current_pr_assessment?.test_files_detected?.length > 0 && (
                            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs space-y-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                                Test Suites Identified in Changes ({evidenceInvestigation.current_pr_assessment.test_files_detected.length}):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {(evidenceInvestigation.current_pr_assessment.test_files_detected || []).map((tf, tfIdx) => (
                                  <span key={tfIdx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#17191F] text-emerald-300 border border-emerald-700/60 font-semibold">
                                    {tf}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Security & Test Coverage Summaries */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                            <div className="p-2.5 rounded-lg bg-[#202329] border border-[#2B2E35] space-y-1">
                              <span className="text-[10px] font-bold text-[#777D87] uppercase">Security Review</span>
                              <p className="text-[#B0B3BA] text-[11px] leading-relaxed">
                                {evidenceInvestigation.current_pr_assessment?.security_concerns || evidenceInvestigation.current_pr_assessment?.security_and_bugs_check}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-[#202329] border border-[#2B2E35] space-y-1">
                              <span className="text-[10px] font-bold text-[#777D87] uppercase">Test Rigor</span>
                              <p className="text-[#B0B3BA] text-[11px] leading-relaxed">
                                {evidenceInvestigation.current_pr_assessment?.test_coverage_evaluation}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* CARD C: EVIDENCE CONFIDENCE & COVERAGE SCOPE */}
                        <div className="p-4 rounded-xl bg-[#202329] border border-[#2B2E35] space-y-3 text-xs">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[#B0B3BA] block">
                                Assessment C: Evidence Confidence &amp; Code Coverage
                              </span>
                              <span className="text-[11px] text-[#B0B3BA]">
                                Depth of source code and unified git diffs analyzed
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${
                                evidenceInvestigation.evidence_confidence?.confidence_level === 'HIGH'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                  : evidenceInvestigation.evidence_confidence?.confidence_level === 'MEDIUM'
                                  ? 'bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]'
                                  : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              }`}>
                                {evidenceInvestigation.evidence_confidence?.confidence_level} CONFIDENCE
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                                evidenceInvestigation.evidence_confidence?.coverage_status === 'FULL_CODE_ANALYSIS'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                  : 'bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]'
                              }`}>
                                {evidenceInvestigation.evidence_confidence?.coverage_status || 'CODE_ANALYZED'}
                              </span>
                            </div>
                          </div>

                          {/* Metrics Strip */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-[#17191F] border border-[#2B2E35]">
                              <span className="text-[10px] text-[#777D87] block">PRs Available</span>
                              <span className="font-bold text-[#F5F5F5] font-mono text-sm">
                                {evidenceInvestigation.evidence_confidence?.total_prs_available || evidenceInvestigation.evidence_confidence?.total_prs_analyzed || 0}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-[#17191F] border border-[#2B2E35]">
                              <span className="text-[10px] text-[#777D87] block">PRs Inspected</span>
                              <span className="font-bold text-[#F5F5F5] font-mono text-sm">
                                {evidenceInvestigation.evidence_confidence?.prs_inspected_count || evidenceInvestigation.evidence_confidence?.deep_diffs_analyzed || 0}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-[#17191F] border border-[#2B2E35]">
                              <span className="text-[10px] text-[#777D87] block">Files Analyzed</span>
                              <span className="font-bold text-[#F5F5F5] font-mono text-sm">
                                {evidenceInvestigation.evidence_confidence?.files_analyzed_count || 0}
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-[#17191F] border border-[#2B2E35]">
                              <span className="text-[10px] text-[#777D87] block">Diff Lines Read</span>
                              <span className="font-bold text-[#F5F5F5] font-mono text-sm">
                                {evidenceInvestigation.evidence_confidence?.lines_analyzed_count || 0}
                              </span>
                            </div>
                          </div>

                          {/* Sampling Strategy */}
                          {evidenceInvestigation.evidence_confidence?.sampling_strategy_explained && (
                            <div className="text-[11px] text-[#B0B3BA] bg-[#17191F] p-2.5 rounded-lg border border-[#2B2E35]">
                              <span className="font-bold text-[#F5F5F5]">Sampling Disclosure: </span>
                              <span>{evidenceInvestigation.evidence_confidence.sampling_strategy_explained}</span>
                            </div>
                          )}

                          {/* Secret Redaction Badge */}
                          {evidenceInvestigation.secret_redaction_applied && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 text-[11px] font-semibold">
                              <Lock className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Credential Redaction Applied: All detected tokens and secrets were sanitized before LLM analysis.</span>
                            </div>
                          )}
                        </div>

                        {/* CARD D: MAINTAINER REVIEW CHECKLIST */}
                        {evidenceInvestigation.investigation_checklist?.length > 0 && (
                          <div className="p-4 rounded-xl bg-[#202329] border border-[#2B2E35] space-y-2 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-[#F5F5F5] text-xs">
                              <ListChecks className="w-4 h-4 text-[#777D87]" />
                              <span>Recommended Maintainer Review Actions</span>
                            </div>
                            <ul className="space-y-1.5 text-[#B0B3BA] text-[11px]">
                              {(evidenceInvestigation.investigation_checklist || []).map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-[#B0B3BA] font-bold shrink-0">{idx + 1}.</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: PUBLIC PR EVIDENCE & CODE DIFFS */}
                    {evidenceTab === 'evidence_timeline' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-[#B0B3BA] pb-1">
                          <div>
                            <span className="font-semibold text-[#F5F5F5]">
                              Authored Pull Requests by @{selectedContributor?.username} (Cross-Repository)
                            </span>
                            <span className="text-[11px] text-[#777D87] block">
                              Public cross-repository evidence authored by this contributor. Excludes reviews, assignees, and other contributors.
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-[#777D87]">
                            {evidenceInvestigation.pr_records?.length || 0} authored records
                          </span>
                        </div>

                        {(!evidenceInvestigation.pr_records || evidenceInvestigation.pr_records.length === 0) ? (
                          <div className="p-8 text-center text-xs text-[#777D87] bg-[#202329] rounded-xl border border-[#2B2E35]">
                            No accessible public pull requests authored by @{selectedContributor?.username} were found on GitHub.
                            <div className="mt-1 text-[11px] text-[#777D87]">
                              Per MergeGuard fairness rules, newcomer baseline applies without penalty.
                            </div>
                          </div>
                        ) : (
                          <div className="divide-y divide-[#242730] border border-[#2B2E35] rounded-xl overflow-hidden bg-[#17191F] shadow-xs">
                            {(evidenceInvestigation.pr_records || []).map((pr) => {
                              const isExpanded = expandedPrId === pr.id;
                              return (
                                <div key={pr.id} className="p-3.5 text-xs hover:bg-[#202329] transition-colors space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-[#F5F5F5] bg-[#202329] px-2 py-0.5 rounded text-[11px] border border-[#2B2E35] text-[#B0B3BA]">
                                          {pr.repo_name}
                                        </span>
                                        <span className="font-bold text-[#F5F5F5] truncate">
                                          #{pr.pr_number} {pr.title}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                                          pr.is_merged
                                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                            : pr.state === 'closed'
                                            ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                                            : 'bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]'
                                        }`}>
                                          {pr.is_merged ? 'Merged' : (pr.state === 'closed' ? 'Closed' : 'Open')}
                                        </span>
                                        {pr.is_external && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]">
                                            External Public GitHub
                                          </span>
                                        )}
                                      </div>

                                      <div className="text-[11px] text-[#B0B3BA] flex items-center gap-3 mt-1 font-mono">
                                        <span className="text-emerald-400 font-medium">+{pr.additions || 0}</span>
                                        <span className="text-rose-400 font-medium">-{pr.deletions || 0}</span>
                                        {pr.html_url && (
                                          <a
                                            href={pr.html_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[#B0B3BA] hover:text-[#F5F5F5] hover:underline flex items-center gap-1"
                                          >
                                            <span>View on GitHub</span>
                                            <ExternalLink className="w-3 h-3 text-[#B0B3BA]" />
                                          </a>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => setExpandedPrId(isExpanded ? null : pr.id)}
                                      className="mg-btn-secondary text-[11px] py-1 px-2 shrink-0 flex items-center gap-1"
                                    >
                                      <Code2 className="w-3.5 h-3.5 text-[#777D87]" />
                                      <span>{isExpanded ? 'Hide Code Diff' : 'Inspect Code Diff'}</span>
                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                  </div>

                                  {/* EXPANDED CODE DIFF & REVIEWS */}
                                  {isExpanded && (
                                    <div className="mt-2 pt-2 border-t border-[#2B2E35] space-y-2.5 animate-fade-in">
                                      {/* Changed Files */}
                                      {pr.changed_files && pr.changed_files.length > 0 && (
                                        <div className="space-y-1">
                                          <span className="text-[10px] font-bold text-[#777D87] uppercase tracking-wider">
                                            Modified Files ({pr.changed_files.length}):
                                          </span>
                                          <div className="flex flex-wrap gap-1.5">
                                            {(pr.changed_files || []).map((cf, cfIdx) => (
                                              <span
                                                key={cfIdx}
                                                className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]"
                                              >
                                                {cf.filename} (+{cf.additions}/-{cf.deletions})
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Code Diff Patch */}
                                      {pr.diff_snippet ? (
                                        <div className="space-y-1">
                                          <span className="text-[10px] font-bold text-[#777D87] uppercase tracking-wider">
                                            Representative Code Diff Snippet:
                                          </span>
                                          <pre className="p-3 rounded-lg bg-[#090A0C] border border-[#2B2E35] text-slate-200 font-mono text-[10px] overflow-x-auto max-h-48 leading-relaxed whitespace-pre-wrap">
                                            {pr.diff_snippet}
                                          </pre>
                                        </div>
                                      ) : (
                                        <p className="text-[11px] text-[#777D87] italic">
                                          No diff snippet downloaded for this record.
                                        </p>
                                      )}

                                      {/* Closure Reason if closed unmerged */}
                                      {pr.closure_reason && (
                                        <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300">
                                          <span className="font-bold">Closure Context: </span>
                                          <span>{pr.closure_reason}</span>
                                        </div>
                                      )}

                                      {/* Review Comments */}
                                      {pr.review_comments && pr.review_comments.length > 0 && (
                                        <div className="space-y-1 pt-1">
                                          <span className="text-[10px] font-bold text-[#777D87] uppercase tracking-wider">
                                            Review Feedback:
                                          </span>
                                          <div className="space-y-1">
                                            {(pr.review_comments || []).map((rv, rvIdx) => (
                                              <div key={rvIdx} className="p-2 rounded bg-[#202329] border border-[#2B2E35] text-[11px]">
                                                <span className="font-bold text-[#F5F5F5]">@{rv.reviewer} ({rv.state}): </span>
                                                <span className="text-[#B0B3BA]">{rv.comment}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              <div className="mg-card p-4 space-y-3 bg-[#202329] border border-[#2B2E35] shadow-xs">
                <div className="flex items-center justify-between text-xs pb-1">
                  <div className="flex items-center gap-2 font-bold text-[#F5F5F5]">
                    <Clock className="w-4 h-4 text-[#777D87]" />
                    <span>Contributor Activity Timeline (@{selectedContributor?.username})</span>
                  </div>
                  <span className="text-[10px] text-[#777D87]">
                    Only authored PRs &amp; direct trust signals
                  </span>
                </div>

                {(!Array.isArray(activityTimeline) || activityTimeline.length === 0) ? (
                  <div className="p-4 text-center text-xs text-[#777D87]">
                    No recorded timeline events or authored pull requests for this contributor yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[#242730] border border-[#2B2E35] rounded-xl overflow-hidden bg-[#17191F] text-xs shadow-xs">
                    {(Array.isArray(activityTimeline) ? activityTimeline : []).map((item, idx) => (
                      <div key={idx} className="p-3 flex items-start justify-between gap-3 hover:bg-[#202329] transition-colors">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="mt-0.5 shrink-0">
                            {item.type === 'VOUCH_RECEIVED' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : item.type === 'REPORT_FILED' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                            ) : (
                              <GitPullRequest className="w-4 h-4 text-[#777D87]" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-[#F5F5F5]">
                              {item.title || item.description || item.type}
                            </div>
                            <div className="text-[11px] text-[#B0B3BA] mt-0.5">
                              {item.description && <span>{item.description} </span>}
                              {item.evidence_url && (
                                <a
                                  href={item.evidence_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#B0B3BA] hover:text-[#F5F5F5] hover:underline inline-flex items-center gap-0.5 ml-1"
                                >
                                  <span>View PR / Evidence</span>
                                  <ExternalLink className="w-3 h-3 text-[#B0B3BA]" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] text-[#777D87] font-mono shrink-0 whitespace-nowrap">
                          {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'recent'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-[#111318] px-6 py-3 border-t border-[#2B2E35] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedContributor(null)}
                className="mg-btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}

      {/* MODAL: ADD CONTRIBUTOR (Rendered into document.body via Portal) */}
      {showAddModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={() => setShowAddModal(false)}
        >
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
            <div
              className="relative w-full max-w-lg bg-[#17191F] text-[#F5F5F5] rounded-2xl shadow-2xl border border-[#2B2E35] my-auto overflow-hidden text-left animate-fade-in-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#111318] px-6 py-4 border-b border-[#2B2E35] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-[#D69B45]">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-base text-[#F5F5F5]">
                    Register Contributor
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 text-[#777D87] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202329] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs bg-[#17191F]">
                {addError && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                    {addError}
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-[#B0B3BA] mb-1">
                    GitHub Username *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87] font-mono">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      value={addForm.username}
                      onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                      placeholder="octocat"
                      className="mg-input pl-8 text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#B0B3BA] mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={addForm.display_name}
                    onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })}
                    placeholder="Mona Lisa Octocat"
                    className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#B0B3BA] mb-1">
                    Bio / Focus Areas
                  </label>
                  <textarea
                    rows={2}
                    value={addForm.bio}
                    onChange={(e) => setAddForm({ ...addForm, bio: e.target.value })}
                    placeholder="Core contributor working on runtime and performance..."
                    className="mg-input text-xs resize-none bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#B0B3BA] mb-1">
                    Skills (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={addForm.skills}
                    onChange={(e) => setAddForm({ ...addForm, skills: e.target.value })}
                    placeholder="Rust, WebAssembly, Security"
                    className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#2B2E35]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="mg-btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="mg-btn-primary text-xs"
                  >
                    {addLoading ? 'Onboarding...' : 'Onboard Contributor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
