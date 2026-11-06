import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Download,
  Upload,
  RefreshCw,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

export default function SettingsView({ aiStatus }) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [exportedJson, setExportedJson] = useState('');
  const [importJson, setImportJson] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await api.getProjects();
        setProjects(data);
        if (data.length > 0) setSelectedProjectId(data[0].id);
      } catch (e) {
        console.error('Error fetching projects:', e);
      }
    }
    fetchProjects();
  }, []);

  const handleExport = async () => {
    if (!selectedProjectId) return;
    try {
      const bundle = await api.exportFederationBundle(selectedProjectId);
      setExportedJson(JSON.stringify(bundle, null, 2));
    } catch (err) {
      console.error('Failed to export bundle:', err);
    }
  };

  const handleImport = async () => {
    try {
      setImportStatus('Importing...');
      const parsed = JSON.parse(importJson);
      const res = await api.importFederationBundle(parsed);
      setImportStatus(`Success: ${res.message}`);
    } catch (err) {
      setImportStatus(`Import Error: ${err.message}`);
    }
  };

  const handleCopyExport = () => {
    if (!exportedJson) return;
    navigator.clipboard.writeText(exportedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset the MergeGuard database back to its synthetic seed state?')) return;
    try {
      setResetting(true);
      await api.resetDemoData();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in-up font-sans">
      {/* Header */}
      <div className="pb-6 border-b border-[#E8E6DF]">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Settings &amp; Federation
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Export cryptographic trust bundles, peer with external organizations, and manage AI intelligence runtime settings.
        </p>
      </div>

      {resetSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Database successfully reset to clean synthetic seed baseline.</span>
        </div>
      )}

      {/* AI MODEL RUNTIME CONFIG */}
      <div className="mg-card p-6 space-y-4 bg-white shadow-xs">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900">
          <Cpu className="w-4 h-4 text-indigo-600" />
          <span>AI Architecture &amp; Model Runtime</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF]">
            <span className="text-slate-400 text-[10px] uppercase block font-sans font-semibold">Configured Model</span>
            <span className="text-slate-900 text-base font-bold mt-1 block">
              {aiStatus?.model_name || 'GPT-OSS-120B'}
            </span>
            <span className="text-slate-500 text-[11px] mt-0.5 block font-sans">
              Open-Weight Architecture (Apache 2.0)
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF]">
            <span className="text-slate-400 text-[10px] uppercase block font-sans font-semibold">Execution Engine</span>
            <span className="text-emerald-700 text-base font-bold mt-1 block flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {aiStatus?.mode || 'Deterministic Engine'}
            </span>
            <span className="text-slate-500 text-[11px] mt-0.5 block font-sans">
              {aiStatus?.is_live_configured
                ? 'Live Groq API Inference Active'
                : 'Deterministic Fallback Active (Zero Secret Leakage)'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Trust scoring, newcomer neutrality, and policy calculations are evaluated deterministically by the Python FastAPI backend engine.
          The AI model is strictly dedicated to summarizing multi-repository diffs and explaining coordinated patterns to maintainers.
        </p>
      </div>

      {/* FEDERATION EXPORT */}
      <div className="mg-card p-6 space-y-4 bg-white shadow-xs">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900">
          <Download className="w-4 h-4 text-indigo-600" />
          <span>Export Repository Trust Bundle</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Generate an attributable, signed JSON bundle containing your repository's vouches, denouncements, and peering edges to share with partner organizations.
        </p>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="mg-input text-xs font-mono sm:w-72"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            className="mg-btn-primary text-xs"
          >
            <span>Generate Bundle</span>
          </button>
        </div>

        {exportedJson && (
          <div className="space-y-2 animate-fade-in-up">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px] font-bold">SIGNED FEDERATION JSON PAYLOAD</span>
              <button
                onClick={handleCopyExport}
                className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 font-mono text-[11px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[#FAF9F5] border border-[#E8E6DF] font-mono text-[11px] text-slate-800 max-h-56 overflow-y-auto">
              {exportedJson}
            </pre>
          </div>
        )}
      </div>

      {/* FEDERATION IMPORT */}
      <div className="mg-card p-6 space-y-4 bg-white shadow-xs">
        <div className="flex items-center gap-2.5 text-sm font-bold text-slate-900">
          <Upload className="w-4 h-4 text-indigo-600" />
          <span>Import External Peer Bundle</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Paste a signed federation bundle from an external repository node to merge its trust signals into your local repository network.
        </p>

        <textarea
          rows={3}
          placeholder='{"version": "1.0.0", "source_project": { ... }, "vouches": [ ... ]}'
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          className="mg-input font-mono text-xs"
        />

        <div className="flex items-center justify-between">
          <button
            onClick={handleImport}
            className="mg-btn-secondary text-xs"
          >
            Import Peer Bundle
          </button>
          {importStatus && (
            <span className="text-xs font-mono font-medium text-indigo-600">{importStatus}</span>
          )}
        </div>
      </div>

      {/* DANGER ZONE / DEMO RESET */}
      <div className="mg-card p-6 border-rose-200 bg-white space-y-3.5 shadow-xs">
        <div className="text-rose-700 font-bold text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Reset Demonstration Database</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Restore all projects, contributors, vouches, denouncements, and coordinated campaign scenarios back to the clean synthetic demo baseline.
        </p>
        <button
          onClick={handleResetDemo}
          disabled={resetting}
          className="mg-btn-danger text-xs"
        >
          {resetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
          <span>Reset to Clean Synthetic Demo State</span>
        </button>
      </div>
    </div>
  );
}
