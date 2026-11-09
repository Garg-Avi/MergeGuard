import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import {
  FolderGit2,
  Star,
  Sliders,
  ExternalLink,
  Save,
  RefreshCw,
  Plus,
  Network,
  X,
  GitPullRequest,
  Search,
  Check,
  Bot,
  Sparkles,
  GitMerge,
  TrendingUp,
  Clock,
  Shield,
  ListChecks,
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';

export default function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [editingId, setEditingId] = useState(null);
  const [editPolicy, setEditPolicy] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // GitHub Integration State
  const [githubStatus, setGithubStatus] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importCategory, setImportCategory] = useState('Infrastructure');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [syncingId, setSyncingId] = useState(null);

  // Register Project Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    slug: '',
    description: '',
    repo_url: '',
    category: 'Infrastructure',
    stars: 120,
    strictness: 'balanced',
    min_confidence: 0.60,
  });
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Peering & Relationship Modal
  const [peeringProj, setPeeringProj] = useState(null);
  const [relationships, setRelationships] = useState(null);
  const [relLoading, setRelLoading] = useState(false);
  const [newPeerTargetId, setNewPeerTargetId] = useState('');
  const [newPeerWeight, setNewPeerWeight] = useState(0.8);
  const [peerSaving, setPeerSaving] = useState(false);

  // Pull Requests in Modal
  const [peeringTab, setPeeringTab] = useState('peering'); // 'peering' | 'pulls'
  const [projectPulls, setProjectPulls] = useState([]);
  const [verifyingPrNumber, setVerifyingPrNumber] = useState(null);

  // Author GPT Inspection Modal
  const [inspectingAuthor, setInspectingAuthor] = useState(null);
  const [authorAiLoading, setAuthorAiLoading] = useState(false);
  const [authorAiData, setAuthorAiData] = useState(null);

  const handleInspectAuthor = async (username, projectId, prNumber = null, forceRefresh = false) => {
    setInspectingAuthor(username);
    setAuthorAiData(null);
    setAuthorAiLoading(true);
    try {
      const res = await api.investigateEvidence(username, projectId, prNumber, forceRefresh);
      setAuthorAiData(res);
    } catch (err) {
      console.error('Failed to inspect author with GPT:', err);
    } finally {
      setAuthorAiLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGitHubStatus = async () => {
    try {
      const status = await api.getGitHubStatus();
      setGithubStatus(status);
    } catch (err) {
      console.warn('GitHub status load error:', err);
    }
  };

  useEffect(() => {
    loadProjects();
    loadGitHubStatus();
  }, []);

  const handleStartEdit = (proj) => {
    setEditingId(proj.id);
    setEditPolicy({
      strictness: proj.trust_policy?.strictness || 'balanced',
      min_confidence: proj.trust_policy?.min_confidence ?? 0.60,
    });
  };

  const handleSavePolicy = async (id) => {
    try {
      setSaving(true);
      const updated = await api.updateProject(id, {
        trust_policy: editPolicy,
      });
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      setSuccessMsg(`Trust policy updated for "${updated.name}"`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(`Error updating policy: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegisterError('');
    if (!registerForm.name.trim()) {
      setRegisterError('Project name is required.');
      return;
    }
    const slug = registerForm.slug.trim() || registerForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
      setRegisterLoading(true);
      await api.createProject({
        name: registerForm.name.trim(),
        slug: slug,
        description: registerForm.description.trim(),
        repo_url: registerForm.repo_url.trim(),
        category: registerForm.category,
        stars: parseInt(registerForm.stars, 10) || 0,
        trust_policy: {
          strictness: registerForm.strictness,
          min_confidence: parseFloat(registerForm.min_confidence) || 0.6,
          peer_weights: {},
        },
      });
      setSuccessMsg(`Project "${registerForm.name}" registered successfully.`);
      setShowRegisterModal(false);
      setRegisterForm({
        name: '',
        slug: '',
        description: '',
        repo_url: '',
        category: 'Infrastructure',
        stars: 120,
        strictness: 'balanced',
        min_confidence: 0.60,
      });
      await loadProjects();
    } catch (err) {
      setRegisterError(err.message || 'Failed to register project.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    setImportError('');
    if (!importUrl.trim()) {
      setImportError('Please enter a GitHub repository URL.');
      return;
    }
    try {
      setImportLoading(true);
      const imported = await api.importGitHubRepo(importUrl.trim(), importCategory);
      setSuccessMsg(`Imported GitHub repository "${imported.name}" and synchronized pull requests.`);
      setShowImportModal(false);
      setImportUrl('');
      await loadProjects();
    } catch (err) {
      setImportError(err.message || 'Failed to import repository from GitHub.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleSyncProject = async (projectId) => {
    try {
      setSyncingId(projectId);
      const res = await api.syncProjectGitHub(projectId);
      setSuccessMsg(res.message);
      await loadProjects();
      if (peeringProj && peeringProj.id === projectId) {
        const pulls = await api.getProjectGitHubPulls(projectId);
        setProjectPulls(pulls);
      }
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleVerifyPR = async (projectId, prNumber, canonicalUrl) => {
    try {
      setVerifyingPrNumber(prNumber);
      const res = await api.verifyGitHubPR(projectId, prNumber, canonicalUrl);
      setProjectPulls((prev) =>
        prev.map((pr) =>
          pr.pr_number === prNumber
            ? { ...pr, verification_status: res.verification_status, verification_details: res.verification_details }
            : pr
        )
      );
    } catch (err) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifyingPrNumber(null);
    }
  };

  const handleOpenPeering = async (proj) => {
    setPeeringProj(proj);
    setRelationships(null);
    setPeeringTab(proj.is_github_connected ? 'pulls' : 'peering');
    try {
      setRelLoading(true);
      const [relData, pullsData] = await Promise.all([
        api.getProjectRelationships(proj.id),
        api.getProjectGitHubPulls(proj.id),
      ]);
      setRelationships(relData);
      setProjectPulls(pullsData);
      const other = projects.find((p) => p.id !== proj.id);
      if (other) setNewPeerTargetId(other.id);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setRelLoading(false);
    }
  };

  const handleSavePeerWeight = async () => {
    if (!peeringProj || !newPeerTargetId) return;
    try {
      setPeerSaving(true);
      await api.setProjectPeerWeight(peeringProj.id, {
        target_project_id: newPeerTargetId,
        trust_weight: parseFloat(newPeerWeight) || 0.8,
        notes: `Peer weight configured by ${peeringProj.name}`,
      });
      const updatedRel = await api.getProjectRelationships(peeringProj.id);
      setRelationships(updatedRel);
      await loadProjects();
    } catch (err) {
      alert(`Error updating peer weight: ${err.message}`);
    } finally {
      setPeerSaving(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...new Set(projects.map((p) => p.category).filter(Boolean))];

  return (
    <div className="space-y-6 animate-fade-in-up font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2B2E35]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F5F5F5] tracking-tight">
              Repositories
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#202329] text-[#B0B3BA] font-semibold font-mono border border-[#2B2E35]">
              {projects.length}
            </span>
            {githubStatus && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 text-[10px] font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                GitHub API Active
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[#B0B3BA] mt-1">
            Manage connected GitHub repositories and trust policies.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setShowImportModal(true)}
            className="mg-btn-primary text-xs shadow-xs"
          >
            <GithubIcon className="w-4 h-4 text-white" />
            <span>Connect GitHub Repository</span>
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="mg-btn-secondary text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Repository</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-[#777D87] hover:text-[#F5F5F5]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777D87]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories..."
            className="mg-input pl-9 text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs text-[#777D87] shrink-0 font-medium">Category:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-all shrink-0 ${
                categoryFilter === cat
                  ? 'bg-[#202329] text-[#F5F5F5] font-semibold border border-[#D69B45]/50 shadow-xs'
                  : 'text-[#B0B3BA] hover:text-[#F5F5F5] hover:bg-[#202329]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* REPOSITORIES GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-52 mg-skeleton" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="mg-card p-14 text-center text-xs text-[#777D87] bg-[#17191F] border-[#2B2E35]">
          <FolderGit2 className="w-10 h-10 mx-auto text-[#777D87] mb-3" />
          <p className="font-bold text-[#F5F5F5] text-sm">No repositories found</p>
          <p className="mt-1 text-[#777D87]">Try modifying your search or import a repository.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((p) => {
            const peerCount = Object.keys(p.trust_policy?.peer_weights || {}).length;
            const isEditing = editingId === p.id;
            const strictness = p.trust_policy?.strictness || 'balanced';

            return (
              <div key={p.id} className="mg-card-interactive p-6 flex flex-col justify-between bg-[#17191F] border border-[#2B2E35]">
                <div>
                  {/* Top Bar: Name, Stars, Category */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-[#B0B3BA] shrink-0">
                        <FolderGit2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base text-[#F5F5F5] truncate">
                            {p.name}
                          </h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]">
                            {p.category}
                          </span>
                        </div>
                        <div className="text-xs text-[#777D87] font-mono mt-0.5 truncate">
                          {p.slug}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold font-mono shrink-0">
                      <Star className="w-3.5 h-3.5 fill-amber-400 stroke-none" />
                      <span>{p.stars?.toLocaleString() || 0}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#B0B3BA] mt-3.5 line-clamp-2 leading-relaxed">
                    {p.description || 'No description provided for this repository.'}
                  </p>

                  {/* Metadata Chips */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]">
                      Strictness: <span className="font-semibold text-[#F5F5F5] capitalize">{strictness}</span>
                    </span>

                    <span className="px-2.5 py-0.5 rounded-lg bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]">
                      Min Confidence: <span className="font-mono text-[#F5F5F5] font-semibold">{((p.trust_policy?.min_confidence ?? 0.6) * 100).toFixed(0)}%</span>
                    </span>

                    <span className="px-2.5 py-0.5 rounded-lg bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]">
                      Peers: <span className="font-mono text-emerald-400 font-bold">{peerCount}</span>
                    </span>

                    {p.is_github_connected && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1 font-mono text-[10px] font-medium">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>GitHub Synced</span>
                      </span>
                    )}
                  </div>

                  {/* Inline Policy Editor */}
                  {isEditing && (
                    <div className="mt-4 p-4 rounded-xl bg-[#202329] border border-[#2B2E35] space-y-3.5 animate-fade-in-up">
                      <div className="text-xs font-bold text-[#F5F5F5] flex items-center justify-between">
                        <span>Tune Repository Trust Policy</span>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-[#777D87] hover:text-[#F5F5F5]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[#B0B3BA] font-medium mb-1">Strictness</label>
                          <select
                            value={editPolicy.strictness}
                            onChange={(e) => setEditPolicy({ ...editPolicy, strictness: e.target.value })}
                            className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                          >
                            <option value="lenient">Lenient (Forgiving)</option>
                            <option value="balanced">Balanced (Default)</option>
                            <option value="strict">Strict (High Assurance)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[#B0B3BA] font-medium mb-1">
                            Min Confidence ({(editPolicy.min_confidence * 100).toFixed(0)}%)
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="0.95"
                            step="0.05"
                            value={editPolicy.min_confidence}
                            onChange={(e) => setEditPolicy({ ...editPolicy, min_confidence: parseFloat(e.target.value) })}
                            className="w-full accent-[#D69B45] mt-1"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setEditingId(null)}
                          className="mg-btn-secondary text-xs py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSavePolicy(p.id)}
                          disabled={saving}
                          className="mg-btn-primary text-xs py-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{saving ? 'Saving...' : 'Save Policy'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="mt-5 pt-3.5 border-t border-[#242730] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenPeering(p)}
                      className="mg-btn-secondary text-xs py-1"
                    >
                      <GitPullRequest className="w-3.5 h-3.5 text-[#777D87]" />
                      <span>PRs & Peering</span>
                    </button>

                    <button
                      onClick={() => handleStartEdit(p)}
                      className="mg-btn-secondary text-xs py-1"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#777D87]" />
                      <span>Policy</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {p.repo_url && (
                      <a
                        href={p.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-[#777D87] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202329] transition-colors"
                        title="View on GitHub"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleSyncProject(p.id)}
                      disabled={syncingId === p.id}
                      className="p-1.5 text-[#777D87] hover:text-emerald-400 rounded-lg hover:bg-[#202329] transition-colors"
                      title="Sync Pull Requests via GitHub API"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingId === p.id ? 'animate-spin text-[#D69B45]' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: IMPORT GITHUB REPOSITORY */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-fade-in-up">
          <div className="w-full max-w-lg bg-[#17191F] rounded-2xl shadow-2xl border border-[#2B2E35] overflow-hidden">
            <div className="bg-[#111318] px-6 py-4 border-b border-[#2B2E35] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-white">
                  <GithubIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#F5F5F5]">
                    Import Public GitHub Repository
                  </h3>
                  <p className="text-[11px] text-[#777D87]">Continuous Pull Request Surveillance</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-[#777D87] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202329]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="p-6 space-y-4">
              {importError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
                  {importError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#B0B3BA] mb-1.5">
                  Public GitHub Repository URL
                </label>
                <input
                  type="url"
                  required
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://github.com/facebook/react"
                  className="mg-input font-mono text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                />
                <p className="text-[11px] text-[#777D87] mt-1.5">
                  MergeGuard queries GitHub API v3, imports metadata, and synchronizes real pull requests.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#B0B3BA] mb-1.5">
                  Ecosystem Category
                </label>
                <select
                  value={importCategory}
                  onChange={(e) => setImportCategory(e.target.value)}
                  className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                >
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Distributed Systems">Distributed Systems</option>
                  <option value="Developer Tools">Developer Tools</option>
                  <option value="Frontend & UI">Frontend & UI</option>
                  <option value="AI & ML">AI & ML</option>
                  <option value="Security">Security</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#242730]">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="mg-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="mg-btn-primary text-xs"
                >
                  {importLoading ? 'Importing & Synchronizing PRs...' : 'Import Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER CUSTOM PROJECT */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-fade-in-up">
          <div className="w-full max-w-lg bg-[#17191F] rounded-2xl shadow-2xl border border-[#2B2E35] overflow-hidden">
            <div className="bg-[#111318] px-6 py-4 border-b border-[#2B2E35] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-[#D69B45]">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#F5F5F5]">
                    Register Custom Repository
                  </h3>
                  <p className="text-[11px] text-[#777D87]">Custom Perimeter Ledger Node</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 text-[#777D87] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202329]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
              {registerError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
                  {registerError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#B0B3BA] mb-1.5">Name</label>
                  <input
                    type="text"
                    required
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    placeholder="VectorGuard AI"
                    className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#B0B3BA] mb-1.5">Slug (optional)</label>
                  <input
                    type="text"
                    value={registerForm.slug}
                    onChange={(e) => setRegisterForm({ ...registerForm, slug: e.target.value })}
                    placeholder="vectorguard-ai"
                    className="mg-input font-mono text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#B0B3BA] mb-1.5">Repository URL</label>
                <input
                  type="url"
                  value={registerForm.repo_url}
                  onChange={(e) => setRegisterForm({ ...registerForm, repo_url: e.target.value })}
                  placeholder="https://github.com/org/repo"
                  className="mg-input font-mono text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#B0B3BA] mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={registerForm.description}
                  onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                  placeholder="Security and trust proxy for embedding vectors..."
                  className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#B0B3BA] mb-1.5">Category</label>
                  <select
                    value={registerForm.category}
                    onChange={(e) => setRegisterForm({ ...registerForm, category: e.target.value })}
                    className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  >
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Distributed Systems">Distributed Systems</option>
                    <option value="Developer Tools">Developer Tools</option>
                    <option value="AI & ML">AI & ML</option>
                    <option value="Security">Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#B0B3BA] mb-1.5">Policy Strictness</label>
                  <select
                    value={registerForm.strictness}
                    onChange={(e) => setRegisterForm({ ...registerForm, strictness: e.target.value })}
                    className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                  >
                    <option value="lenient">Lenient</option>
                    <option value="balanced">Balanced</option>
                    <option value="strict">Strict</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#242730]">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="mg-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerLoading}
                  className="mg-btn-primary text-xs"
                >
                  {registerLoading ? 'Registering...' : 'Register Repository'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PULL REQUESTS & PEERING MANAGEMENT */}
      {peeringProj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans animate-fade-in-up">
          <div className="w-full max-w-3xl bg-[#17191F] rounded-2xl shadow-2xl border border-[#2B2E35] max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-[#111318] px-6 py-4 border-b border-[#2B2E35] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-[#D69B45]">
                  <FolderGit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#F5F5F5]">
                    {peeringProj.name}
                  </h3>
                  <div className="text-[11px] text-[#777D87] font-mono">
                    {peeringProj.slug}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setPeeringProj(null)}
                className="p-1.5 text-[#777D87] hover:text-[#F5F5F5] rounded-lg hover:bg-[#202329]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Sub-tabs */}
            <div className="flex p-1.5 mx-6 mt-4 bg-[#111318] border border-[#2B2E35] rounded-xl text-xs font-medium shrink-0">
              <button
                onClick={() => setPeeringTab('pulls')}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                  peeringTab === 'pulls'
                    ? 'bg-[#202329] text-[#F5F5F5] font-semibold shadow-xs'
                    : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
                }`}
              >
                <GitPullRequest className="w-3.5 h-3.5 text-[#777D87]" />
                <span>Pull Requests ({projectPulls.length})</span>
              </button>
              <button
                onClick={() => setPeeringTab('peering')}
                className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                  peeringTab === 'peering'
                    ? 'bg-[#202329] text-[#F5F5F5] font-semibold shadow-xs'
                    : 'text-[#B0B3BA] hover:text-[#F5F5F5]'
                }`}
              >
                <Network className="w-3.5 h-3.5 text-[#777D87]" />
                <span>Peer Trust Weights</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* TAB: PULL REQUESTS */}
              {peeringTab === 'pulls' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between text-xs text-[#B0B3BA]">
                    <div>
                      <span className="font-semibold text-[#F5F5F5]">
                        Repository-Wide Pull Requests (All Contributors)
                      </span>
                      <span className="text-[11px] text-[#777D87] block">
                        Synchronized repository activity across all authors from GitHub API.
                      </span>
                    </div>
                    <button
                      onClick={() => handleSyncProject(peeringProj.id)}
                      disabled={syncingId === peeringProj.id}
                      className="text-[#B0B3BA] hover:text-[#F5F5F5] font-medium flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingId === peeringProj.id ? 'animate-spin' : ''}`} />
                      <span>Re-sync PRs</span>
                    </button>
                  </div>

                  {projectPulls.length === 0 ? (
                    <div className="p-10 text-center text-xs text-[#777D87] mg-card bg-[#111318] border border-[#2B2E35] rounded-xl">
                      No pull requests synchronized for this repository yet. Click "Re-sync PRs" to fetch from GitHub.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#242730] border border-[#2B2E35] rounded-xl overflow-hidden bg-[#111318] shadow-xs">
                      {projectPulls.map((pr) => (
                        <div key={pr.id} className="p-3.5 text-xs flex items-start justify-between gap-4 hover:bg-[#202329]/60 transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#F5F5F5] truncate">
                                #{pr.pr_number} {pr.title}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                                pr.verification_status === 'VERIFIED_GITHUB'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                  : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              }`}>
                                {pr.verification_status === 'VERIFIED_GITHUB' ? 'Verified GitHub PR' : 'Pending Verification'}
                              </span>
                            </div>

                            <div className="text-[11px] text-[#777D87] flex items-center gap-3 mt-1 font-mono">
                              <span>Author: @{pr.author_username}</span>
                              <span>&bull; Branch: {pr.head_branch}</span>
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

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleInspectAuthor(pr.author_username, peeringProj.id, pr.pr_number)}
                              className="mg-btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5 text-[#F5F5F5]"
                              title="Run evidence-based engineering investigation with connected GPT"
                            >
                              <Bot className="w-3.5 h-3.5 text-[#777D87]" />
                              <span>Inspect Author (GPT)</span>
                            </button>
                            <button
                              onClick={() => handleVerifyPR(peeringProj.id, pr.pr_number, pr.html_url)}
                              disabled={verifyingPrNumber === pr.pr_number}
                              className="mg-btn-secondary text-[11px] py-1 px-2.5 shrink-0"
                            >
                              {verifyingPrNumber === pr.pr_number ? 'Verifying...' : 'Verify Authenticity'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: PEER TRUST WEIGHTS */}
              {peeringTab === 'peering' && (
                <div className="space-y-4">
                  {/* Configure New Peer Weight */}
                  <div className="p-4 rounded-xl bg-[#202329] border border-[#2B2E35] space-y-3.5">
                    <h4 className="text-xs font-bold text-[#F5F5F5]">
                      Add / Update Subjective Peer Weight
                    </h4>
                    <p className="text-[11px] text-[#777D87]">
                      Signals from the selected repository will be multiplied by this weight when evaluating contributor trust.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[#B0B3BA] font-medium mb-1">Target Repository</label>
                        <select
                          value={newPeerTargetId}
                          onChange={(e) => setNewPeerTargetId(e.target.value)}
                          className="mg-input text-xs bg-[#111318] border-[#2B2E35] text-[#F5F5F5]"
                        >
                          {projects
                            .filter((p) => p.id !== peeringProj.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.slug})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[#B0B3BA] font-medium mb-1">
                          Peer Weight: <span className="font-mono text-[#F5F5F5] font-bold">{(newPeerWeight * 100).toFixed(0)}%</span>
                        </label>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.05"
                          value={newPeerWeight}
                          onChange={(e) => setNewPeerWeight(parseFloat(e.target.value))}
                          className="w-full accent-[#D69B45] mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleSavePeerWeight}
                        disabled={peerSaving || !newPeerTargetId}
                        className="mg-btn-primary text-xs py-1.5"
                      >
                        {peerSaving ? 'Saving...' : 'Set Peer Weight'}
                      </button>
                    </div>
                  </div>

                  {/* Existing Relationships List */}
                  <div>
                    <h4 className="text-xs font-bold text-[#F5F5F5] mb-2.5">
                      Active Peer Relationships
                    </h4>

                    {relLoading ? (
                      <div className="text-xs text-[#777D87] p-4 text-center">Loading relationships...</div>
                    ) : relationships?.outgoing?.length === 0 ? (
                      <div className="p-6 rounded-xl border border-[#2B2E35] text-center text-xs text-[#777D87] bg-[#111318]">
                        No peer trust weights configured yet. Add a peer above to establish subjective trust.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#242730] border border-[#2B2E35] rounded-xl overflow-hidden bg-[#111318] text-xs shadow-xs">
                        {relationships?.outgoing?.map((edge) => (
                          <div key={edge.id} className="p-3 flex items-center justify-between hover:bg-[#202329]/60 transition-colors">
                            <div>
                              <span className="font-bold text-[#F5F5F5]">
                                &rarr; {edge.target_project_name || edge.target_project_id}
                              </span>
                              <div className="text-[10px] text-[#777D87] mt-0.5">
                                {edge.notes || 'Configured subjective peer weight'}
                              </div>
                            </div>
                            <span className="font-mono text-xs text-[#F5F5F5] font-bold bg-[#202329] px-2 py-0.5 rounded-md border border-[#2B2E35]">
                              {(edge.trust_weight * 100).toFixed(0)}% Weight
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#111318] px-6 py-3.5 border-t border-[#2B2E35] flex justify-end shrink-0">
              <button
                onClick={() => setPeeringProj(null)}
                className="mg-btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PR AUTHOR GPT BACKGROUND CHECK */}
      {inspectingAuthor && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="bg-[#17191F] border border-[#2B2E35] rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[#2B2E35] flex items-center justify-between bg-[#111318] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#202329] border border-[#2B2E35] text-[#D69B45] flex items-center justify-center shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-[#F5F5F5]">
                      Author Check: @{inspectingAuthor}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      GPT-OSS-120B Connected
                    </span>
                  </div>
                  <p className="text-[11px] text-[#777D87]">
                    Live background evaluation of past pull requests and acceptance rate
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingAuthor(null)}
                className="text-[#777D87] hover:text-[#F5F5F5] p-1 rounded-md hover:bg-[#202329]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-1 bg-[#090A0C]">
              {authorAiLoading && (
                <div className="p-8 text-center text-xs text-[#B0B3BA] space-y-2.5 bg-[#17191F] rounded-xl border border-[#2B2E35]">
                  <RefreshCw className="w-6 h-6 text-[#D69B45] animate-spin mx-auto" />
                  <p className="font-semibold text-[#F5F5F5]">Connecting to Groq GPT-OSS-120B...</p>
                  <p className="text-[11px] text-[#777D87] max-w-sm mx-auto">
                    Retrieving PR history, calculating merge acceptance %, and generating maintainer triage summary.
                  </p>
                </div>
              )}

              {!authorAiLoading && authorAiData && (
                <div className="space-y-3.5">
                  {/* ASSESSMENT A: BACKGROUND QUALITY */}
                  <div className="p-3.5 rounded-xl bg-[#17191F] border border-[#2B2E35] space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#B0B3BA] block">
                          Assessment A: Engineering Quality
                        </span>
                        <p className="text-xs text-[#B0B3BA] leading-relaxed font-medium mt-0.5">
                          {authorAiData.background_assessment?.summary}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-[#777D87] block font-bold uppercase">Rating</span>
                        <span className="text-xl font-black text-[#F5F5F5] font-mono">
                          {Math.round((authorAiData.background_assessment?.engineering_quality_rating ?? 0.5) * 100)}%
                        </span>
                      </div>
                    </div>

                    {/* Rubric Breakdown */}
                    {authorAiData.background_assessment?.rubric_breakdown && (
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        <div className="p-1.5 rounded bg-[#111318] border border-[#2B2E35] text-center">
                          <span className="text-[9px] text-[#777D87] block">Structure</span>
                          <span className="font-bold text-[#F5F5F5] font-mono text-[10px]">
                            {Math.round((authorAiData.background_assessment.rubric_breakdown.code_structure ?? 0.5) * 100)}%
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-[#111318] border border-[#2B2E35] text-center">
                          <span className="text-[9px] text-[#777D87] block">Maintainability</span>
                          <span className="font-bold text-[#F5F5F5] font-mono text-[10px]">
                            {Math.round((authorAiData.background_assessment.rubric_breakdown.maintainability ?? 0.5) * 100)}%
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-[#111318] border border-[#2B2E35] text-center">
                          <span className="text-[9px] text-[#777D87] block">Tests</span>
                          <span className="font-bold text-[#F5F5F5] font-mono text-[10px]">
                            {Math.round((authorAiData.background_assessment.rubric_breakdown.test_coverage ?? 0.5) * 100)}%
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-[#111318] border border-[#2B2E35] text-center">
                          <span className="text-[9px] text-[#777D87] block">Collaboration</span>
                          <span className="font-bold text-[#F5F5F5] font-mono text-[10px]">
                            {Math.round((authorAiData.background_assessment.rubric_breakdown.collaboration ?? 0.5) * 100)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Signals & Concerns */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#242730] text-[11px]">
                      <div className="space-y-1">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Positive Signals</span>
                        </span>
                        <ul className="space-y-0.5 text-[#B0B3BA]">
                          {(authorAiData.background_assessment?.positive_engineering_signals || []).map((s, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-emerald-400 font-bold">&bull;</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-1">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Potential Concerns</span>
                        </span>
                        <ul className="space-y-0.5 text-[#B0B3BA]">
                          {(authorAiData.background_assessment?.potential_technical_concerns || []).map((c, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-amber-400 font-bold">&bull;</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* ASSESSMENT B: CURRENT PR EVALUATION */}
                  <div className="p-3.5 rounded-xl bg-[#17191F] border border-[#2B2E35] shadow-xs space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#B0B3BA]">
                        Assessment B: Pull Request Code Review
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border bg-[#202329] text-[#B0B3BA] border border-[#2B2E35]">
                        {authorAiData.current_pr_assessment?.verdict || 'REVIEW_READY'}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#B0B3BA] space-y-1">
                      <p>
                        <span className="font-bold text-[#F5F5F5]">Security Check: </span>
                        {authorAiData.current_pr_assessment?.security_and_bugs_check}
                      </p>
                      <p>
                        <span className="font-bold text-[#F5F5F5]">Test Coverage: </span>
                        {authorAiData.current_pr_assessment?.test_coverage_evaluation}
                      </p>
                    </div>

                    {Array.isArray(authorAiData.current_pr_assessment?.code_issues) && authorAiData.current_pr_assessment.code_issues.length > 0 && (
                      <div className="pt-2 border-t border-[#242730] space-y-1.5">
                        <span className="font-bold text-[#F5F5F5] text-[10px] uppercase block">
                          Line-by-Line Code Findings ({authorAiData.current_pr_assessment.code_issues.length}):
                        </span>
                        <div className="space-y-1.5">
                          {authorAiData.current_pr_assessment.code_issues.map((iss, iIdx) => (
                            <div key={iIdx} className="p-2 rounded bg-[#111318] border border-[#2B2E35] text-[11px] space-y-1">
                              <div className="flex items-center justify-between gap-1 flex-wrap font-mono">
                                <span className="font-bold text-[#F5F5F5]">{iss.file}{iss.line ? `:${iss.line}` : ''}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#202329] border border-[#2B2E35] font-bold text-rose-400">{iss.severity}</span>
                              </div>
                              <p className="text-[#B0B3BA]">{iss.description}</p>
                              {iss.suggested_fix && (
                                <p className="text-[10px] text-[#F5F5F5] font-mono">Fix: {iss.suggested_fix}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(authorAiData.current_pr_assessment?.code_review_findings) && authorAiData.current_pr_assessment.code_review_findings.length > 0 && (
                      <div className="pt-1.5 border-t border-[#242730] space-y-1">
                        <span className="font-bold text-[#F5F5F5] text-[10px] uppercase block">Findings:</span>
                        <ul className="space-y-0.5 text-[#B0B3BA] text-[11px]">
                          {authorAiData.current_pr_assessment.code_review_findings.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-[#B0B3BA] font-bold">&bull;</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* ASSESSMENT C: EVIDENCE CONFIDENCE */}
                  <div className="p-3 rounded-xl bg-[#17191F] border border-[#2B2E35] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#777D87] block">
                        Assessment C: Evidence Depth
                      </span>
                      <span className="text-[#B0B3BA] text-[11px]">
                        {authorAiData.evidence_confidence?.total_prs_analyzed || 0} PRs analyzed across {authorAiData.evidence_confidence?.repos_spanned || 0} repo(s).
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border bg-[#111318] border-[#2B2E35] text-[#F5F5F5]">
                      {authorAiData.evidence_confidence?.confidence_level} CONFIDENCE
                    </span>
                  </div>

                  {/* Maintainer Checklist */}
                  {Array.isArray(authorAiData.investigation_checklist) && authorAiData.investigation_checklist.length > 0 && (
                    <div className="p-3 rounded-xl bg-[#17191F] border border-[#2B2E35] space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-[#F5F5F5] text-xs">
                        <ListChecks className="w-3.5 h-3.5 text-[#777D87]" />
                        <span>Recommended Maintainer Review Actions</span>
                      </div>
                      <ul className="space-y-1 text-[#B0B3BA] text-[11px]">
                        {authorAiData.investigation_checklist.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-[#B0B3BA] font-bold shrink-0">{idx + 1}.</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-[#111318] px-5 py-3 border-t border-[#2B2E35] flex items-center justify-between shrink-0">
              <button
                onClick={() => handleInspectAuthor(inspectingAuthor, peeringProj?.id)}
                disabled={authorAiLoading}
                className="mg-btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${authorAiLoading ? 'animate-spin text-[#D69B45]' : 'text-[#777D87]'}`} />
                <span>Re-run GPT Check</span>
              </button>
              <button
                onClick={() => setInspectingAuthor(null)}
                className="mg-btn-secondary text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
