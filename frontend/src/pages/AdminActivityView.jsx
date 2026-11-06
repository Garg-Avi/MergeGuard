import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Mail,
  Send,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Shield,
  Lock,
  Eye,
  GitBranch,
  FolderGit2,
  Flame,
  X,
} from 'lucide-react';
import { api } from '../services/api';

const CATEGORIES = [
  { id: 'ALL', label: 'All Activities' },
  { id: 'AUTH', label: 'Authentication', icon: Lock },
  { id: 'GITHUB', label: 'GitHub Integration', icon: GitBranch },
  { id: 'PROJECTS', label: 'Project Operations', icon: FolderGit2 },
  { id: 'TRUST', label: 'Trust Network', icon: Shield },
  { id: 'SECURITY', label: 'Security Alerts', icon: AlertTriangle, highlight: true },
];

export default function AdminActivityView({ onOpenAuth }) {
  const [metrics, setMetrics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [emailDeliveries, setEmailDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const [, setError] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, _setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'security' | 'emails' | 'privacy'

  // Test email state
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  // Email detail preview modal
  const [selectedEmail, setSelectedEmail] = useState(null);

  const loadData = async () => {
    try {
      setError(null);
      const [m, a, e] = await Promise.all([
        api.getAdminMetrics().catch((err) => {
          if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('Admin authorization')) {
            setIsAuthorized(false);
          }
          throw err;
        }),
        api.getAdminActivities({ limit: 100 }),
        api.getAdminEmailDeliveries({ limit: 50 }),
      ]);
      setMetrics(m);
      const activityItems = Array.isArray(a) ? a : (a?.items || []);
      const emailItems = Array.isArray(e) ? e : (e?.items || []);
      setActivities(activityItems);
      setEmailDeliveries(emailItems);
      setIsAuthorized(true);
    } catch (err) {
      console.warn('Admin view data load issue:', err);
      if (err.message?.includes('401') || err.message?.includes('403') || err.message?.includes('Admin authorization')) {
        setIsAuthorized(false);
      } else {
        setError(err.message || 'Failed to load monitoring data');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSendTestEmail = async () => {
    try {
      setTestEmailSending(true);
      setTestEmailResult(null);
      const res = await api.sendAdminTestEmail('16avigarg@gmail.com');
      setTestEmailResult(res);
      await loadData();
    } catch (err) {
      setTestEmailResult({
        status: 'FAILED',
        error: err.message || 'Failed to dispatch test notification.',
      });
    } finally {
      setTestEmailSending(false);
    }
  };

  const safeActivities = useMemo(() => {
    return Array.isArray(activities) ? activities : (activities?.items || []);
  }, [activities]);

  const safeEmails = useMemo(() => {
    return Array.isArray(emailDeliveries) ? emailDeliveries : (emailDeliveries?.items || []);
  }, [emailDeliveries]);

  const filteredActivities = useMemo(() => {
    return safeActivities.filter((act) => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const evType = act.event_type || '';
        if (selectedCategory === 'AUTH' && !evType.startsWith('AUTH_')) return false;
        if (selectedCategory === 'GITHUB' && !evType.startsWith('GITHUB_')) return false;
        if (selectedCategory === 'PROJECTS' && !evType.startsWith('PROJECT_')) return false;
        if (selectedCategory === 'TRUST' && !['VOUCH_SUBMITTED', 'DENOUNCEMENT_SUBMITTED', 'TRUST_EVALUATION_COMPLETED'].includes(evType)) return false;
        if (selectedCategory === 'SECURITY' && !['AUTH_FAILED_LOGIN', 'CAMPAIGN_DETECTED'].includes(evType) && act.status !== 'SUSPICIOUS') return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL' && act.status !== selectedStatus) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (act.event_description || '').toLowerCase();
        const user = (act.user_email || act.user_name || act.github_username || '').toLowerCase();
        const type = (act.event_type || '').toLowerCase();
        const proj = (act.project_name || '').toLowerCase();
        if (!desc.includes(q) && !user.includes(q) && !type.includes(q) && !proj.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [safeActivities, selectedCategory, selectedStatus, searchQuery]);

  const securityThreats = useMemo(() => {
    return safeActivities.filter(
      (a) =>
        a.event_type === 'AUTH_FAILED_LOGIN' ||
        a.event_type === 'CAMPAIGN_DETECTED' ||
        a.status === 'SUSPICIOUS' ||
        a.status === 'FAILED'
    );
  }, [safeActivities]);

  const getEventIcon = (eventType) => {
    if (eventType.startsWith('AUTH')) {
      return <Lock className="w-3.5 h-3.5 text-indigo-600" />;
    }
    if (eventType.startsWith('GITHUB')) {
      return <GitBranch className="w-3.5 h-3.5 text-violet-600" />;
    }
    if (eventType.startsWith('PROJECT')) {
      return <FolderGit2 className="w-3.5 h-3.5 text-indigo-600" />;
    }
    if (eventType.startsWith('CAMPAIGN')) {
      return <Flame className="w-3.5 h-3.5 text-rose-600" />;
    }
    return <Shield className="w-3.5 h-3.5 text-emerald-600" />;
  };

  const formatUtcTime = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
    } catch {
      return isoString;
    }
  };

  // If user is not authorized, show locked screen with unlock action
  if (!isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full mg-card p-8 text-center bg-white shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700 mb-4 shadow-xs">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Restricted Admin Area
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            The MergeGuard Activity Monitoring and Email Notification Audit Trail is restricted to authorized administrators. Access is verified server-side via signed admin tokens or master keys.
          </p>
          <div className="p-3.5 bg-[#FAF9F5] border border-[#E8E6DF] rounded-xl text-[11px] font-mono text-indigo-700 text-left mb-6">
            <div className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider mb-0.5">Configured Admin Target</div>
            <div>16avigarg@gmail.com</div>
          </div>
          <button
            onClick={onOpenAuth}
            className="mg-btn-primary w-full py-2.5 text-xs shadow-xs"
          >
            Authenticate as Administrator
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up font-sans">
      {/* Top Banner & Notification Target Card */}
      <div className="mg-card p-6 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              SYSTEM AUDIT PIPELINE
            </span>
            <span className="text-xs text-slate-500 font-mono">Live Event Stream</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Admin Activity
          </h1>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Live administrative record of logins, repository connections, email notification audit trails, and security events. High-priority alerts are dispatched directly to the administrator.
          </p>
        </div>

        {/* Admin Email Target Box */}
        <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF] flex flex-col justify-between gap-3 shrink-0 lg:w-84 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-500 font-bold flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              Notification Recipient
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-xs font-bold text-slate-900 font-mono truncate">
            {metrics?.admin_email || '16avigarg@gmail.com'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-[#E8E6DF]">
            <span>Service: Resend API</span>
            <span className={`font-mono font-medium ${metrics?.resend_configured ? 'text-emerald-700' : 'text-amber-600'}`}>
              {metrics?.resend_configured ? 'Live API Configured' : 'Simulated (.env key empty)'}
            </span>
          </div>
          <button
            onClick={handleSendTestEmail}
            disabled={testEmailSending}
            className="mg-btn-secondary w-full py-1.5 text-xs mt-1"
          >
            <Send className={`w-3.5 h-3.5 ${testEmailSending ? 'animate-spin' : ''}`} />
            <span>{testEmailSending ? 'Dispatching...' : 'Send Test Notification'}</span>
          </button>
        </div>
      </div>

      {testEmailResult && (
        <div className={`p-3.5 rounded-xl text-xs border flex items-center justify-between shadow-xs ${
          testEmailResult.status === 'FAILED'
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          <span>
            {testEmailResult.status === 'FAILED'
              ? `Delivery Error: ${testEmailResult.error}`
              : `Notification successfully dispatched to ${testEmailResult.recipient || '16avigarg@gmail.com'} (Status: ${testEmailResult.delivery_status})`}
          </span>
          <button onClick={() => setTestEmailResult(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary View Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E8E6DF] pb-2 overflow-x-auto text-xs">
        {[
          { id: 'stream', label: 'Activity Stream', count: safeActivities.length, icon: Activity },
          { id: 'security', label: 'Security Threats', count: securityThreats.length, icon: AlertTriangle, highlight: true },
          { id: 'emails', label: 'Email Deliveries', count: safeEmails.length, icon: Mail },
          { id: 'privacy', label: 'Privacy & Governance', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl font-medium transition-all flex items-center gap-2 shrink-0 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${tab.highlight ? 'text-amber-600' : ''}`} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className="px-2 py-0.2 rounded-full bg-slate-100 text-[10px] font-mono text-slate-600">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACTIVITY STREAM */}
      {activeTab === 'stream' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search event type, email, or details..."
                className="mg-input pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activities List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 mg-skeleton" />
              ))}
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="mg-card p-14 text-center text-xs text-slate-500 bg-white">
              <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-900 text-sm">No activities found</p>
              <p className="mt-1 text-slate-500">Try clearing your search query or selecting a different category.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E8E6DF] border border-[#E8E6DF] rounded-2xl overflow-hidden bg-white shadow-xs">
              {filteredActivities.map((act) => {
                const isExpanded = expandedLogId === act.id;
                let parsedMetadata = null;
                try {
                  if (act.metadata_json) parsedMetadata = JSON.parse(act.metadata_json);
                } catch {}

                return (
                  <div key={act.id} className="p-4 text-xs hover:bg-[#FAF9F5] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="mt-0.5 shrink-0 p-1.5 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF]">
                          {getEventIcon(act.event_type)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {act.event_type}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                              act.status === 'SUCCESS'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : act.status === 'FAILED'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {act.status}
                            </span>
                          </div>

                          <div className="text-xs text-slate-700 mt-1">
                            {act.event_description}
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1.5 font-mono">
                            {act.user_email && <span>Actor: {act.user_email}</span>}
                            {act.project_name && <span className="text-indigo-600 font-medium">Project: {act.project_name}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatUtcTime(act.timestamp)}
                        </span>
                        {parsedMetadata && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : act.id)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                            title="Inspect metadata JSON"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata JSON Viewer */}
                    {isExpanded && parsedMetadata && (
                      <div className="mt-3 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF] text-[11px] font-mono text-slate-500 space-y-1 animate-fade-in-up">
                        <div className="text-[10px] uppercase text-slate-700 font-sans font-bold">
                          Sanitized Event Metadata (Zero Credentials Recorded)
                        </div>
                        <pre className="text-slate-700 overflow-x-auto">
                          {JSON.stringify(parsedMetadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SECURITY THREATS */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 shadow-xs">
            <strong className="text-amber-950 font-bold">Security Threat Stream: </strong>
            Filtered view tracking suspicious authentication spikes, brute-force attempts, and coordinated campaign bursts.
          </div>

          {securityThreats.length === 0 ? (
            <div className="mg-card p-14 text-center text-xs text-slate-500 bg-white">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3 opacity-70" />
              <p className="font-bold text-slate-900 text-sm">Zero active security threats</p>
              <p className="mt-1 text-slate-500">Authentication attempts and repository operations are within nominal parameters.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E8E6DF] border border-[#E8E6DF] rounded-2xl overflow-hidden bg-white text-xs shadow-xs">
              {securityThreats.map((threat) => (
                <div key={threat.id} className="p-4 flex items-start justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-slate-900">
                        {threat.event_type} &bull; <span className="text-amber-700">{threat.status}</span>
                      </div>
                      <div className="text-xs text-slate-700 mt-1">{threat.event_description}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1">
                        Target/Actor: {threat.user_email || 'Unauthenticated request'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono shrink-0">
                    {formatUtcTime(threat.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EMAIL AUDIT TRAIL */}
      {activeTab === 'emails' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Transactional Email Dispatches (Target: 16avigarg@gmail.com)</span>
            <button
              onClick={handleRefresh}
              className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Deliveries</span>
            </button>
          </div>

          {safeEmails.length === 0 ? (
            <div className="mg-card p-14 text-center text-xs text-slate-500 bg-white">
              <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-900 text-sm">No email notifications recorded</p>
              <p className="mt-1 text-slate-500">Click "Send Test Notification" above to dispatch a live audit test.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E8E6DF] border border-[#E8E6DF] rounded-2xl overflow-hidden bg-white text-xs shadow-xs">
              {safeEmails.map((eml) => (
                <div key={eml.id} className="p-4 flex items-start justify-between gap-3 hover:bg-[#FAF9F5] transition-colors">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">
                        {eml.subject}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                        eml.status === 'SENT'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : eml.status === 'SIMULATED'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {eml.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-3">
                      <span>Recipient: {eml.recipient}</span>
                      {eml.resend_id && <span>&bull; Resend ID: {eml.resend_id}</span>}
                    </div>

                    {eml.error_message && (
                      <div className="text-[11px] text-rose-600 font-medium">{eml.error_message}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatUtcTime(eml.created_at)}
                    </span>
                    {eml.html_content && (
                      <button
                        onClick={() => setSelectedEmail(eml)}
                        className="mg-btn-secondary text-[11px] py-1 px-2.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PRIVACY & TRANSPARENCY NOTICE */}
      {activeTab === 'privacy' && (
        <div className="mg-card p-6 space-y-4 max-w-3xl text-xs text-slate-700 bg-white shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>MergeGuard Activity Monitoring &amp; Audit Transparency Notice</span>
          </div>

          <p className="leading-relaxed text-slate-600">
            MergeGuard operates a centralized, server-side activity monitoring and threat prevention system.
            To safeguard federated open-source projects against synchronized AI slop campaigns and unauthorized takeovers,
            key operations (account registrations, sign-ins, repository syncs, vouches, and denouncements) are verified and logged.
          </p>

          <div className="space-y-2 pt-3 border-t border-[#E8E6DF]">
            <div className="font-bold text-slate-900">Logged Operations:</div>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>Authentication: Sign-ups, sign-ins, and failed credential attempts.</li>
              <li>GitHub Integration: Repository imports, webhook events, and PR synchronization.</li>
              <li>Project Governance: Repository creations, policy tuning, and peer weighting adjustments.</li>
              <li>MergeGuard Trust Ledger: Verifiable vouches, reports, and AI slop campaign detections.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF] text-[11px] text-slate-600 space-y-1">
            <strong className="text-slate-900 font-bold">Zero Sensitive Data Exposure:</strong>
            <p>
              Passwords, raw secret tokens, private OAuth tokens, and session cookies are strictly excluded
              and NEVER stored or transmitted in notification payloads.
            </p>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL PREVIEW */}
      {selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm font-sans animate-fade-in-up">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E8E6DF] max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-[#FAF9F5] px-6 py-4 border-b border-[#E8E6DF] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900 truncate max-w-md">
                  {selectedEmail.subject}
                </h3>
              </div>
              <button onClick={() => setSelectedEmail(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto bg-white text-slate-900 flex-1">
              <iframe
                title="Email Preview"
                srcDoc={selectedEmail.html_content}
                className="w-full min-h-[400px] border-0"
              />
            </div>

            <div className="bg-[#FAF9F5] px-6 py-3.5 border-t border-[#E8E6DF] flex justify-end shrink-0">
              <button
                onClick={() => setSelectedEmail(null)}
                className="mg-btn-secondary text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
