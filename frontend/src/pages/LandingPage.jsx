import React from 'react';
import HeroNetworkCanvas from '../components/HeroNetworkCanvas';
import {
  Shield,
  Network,
  Users,
  CheckCircle2,
  GitPullRequest,
  ArrowRight,
  ShieldCheck,
  Cpu,
  FolderGit2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import GithubIcon from '../components/GithubIcon';

export default function LandingPage({ onEnterApp }) {
  return (
    <div className="min-h-screen bg-[#FAF9F5] text-slate-900 font-sans selection:bg-indigo-500/15 selection:text-indigo-900 bg-mesh-glow">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/80 backdrop-blur-md border-b border-[#E8E6DF]">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 tracking-tight block leading-none">
                MergeGuard
              </span>
              <span className="text-[10px] text-slate-500 font-medium tracking-normal block mt-1 leading-none">
                Every PR. Under the Lens.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Garg-Avi/MergeGuard"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <GithubIcon className="w-4 h-4 text-slate-700" />
              <span className="font-medium">Garg-Avi/MergeGuard</span>
            </a>

            <button
              onClick={() => onEnterApp('overview')}
              className="mg-btn-primary"
            >
              <span>Launch Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-6 overflow-hidden min-h-[82vh] flex items-center border-b border-[#E8E6DF]">
        <HeroNetworkCanvas />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-xs border border-[#DDD9CE] text-xs text-slate-700 mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            <span className="font-semibold text-slate-900">Pull Request Trust Intelligence Engine</span>
          </div>

          <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight max-w-5xl mx-auto leading-[1.02]">
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 bg-clip-text text-transparent">
              MergeGuard
            </span>
          </h1>

          <div className="mt-4 sm:mt-5 text-2xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Every PR.{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Under the Lens.
            </span>
          </div>

          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            An evidence-driven trust intelligence platform for GitHub repositories and contributors.
            Detect unusual activity, verify code provenance, and understand contributor reputation across projects without guesswork.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onEnterApp('projects')}
              className="mg-btn-primary text-sm px-5 py-2.5"
            >
              <GithubIcon className="w-4 h-4 text-white" />
              <span>Connect GitHub Repository</span>
            </button>
            <button
              onClick={() => onEnterApp('network')}
              className="mg-btn-secondary text-sm px-5 py-2.5"
            >
              <Network className="w-4 h-4 text-indigo-600" />
              <span>Explore Trust Network</span>
            </button>
            <button
              onClick={() => onEnterApp('overview')}
              className="mg-btn-secondary text-sm px-5 py-2.5"
            >
              <span>View Overview</span>
            </button>
          </div>

          {/* Simulated Pull Request Inspection Card */}
          <div className="mt-14 max-w-3xl mx-auto mg-card text-left p-0 overflow-hidden shadow-lg border border-[#DDD9CE]">
            <div className="bg-[#FAF9F5] px-5 py-3 border-b border-[#E8E6DF] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-700">
                <GitPullRequest className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-slate-900">hyperflow-org/hyperflow #412</span>
                <span className="text-slate-500">by @elena-rustacean</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                All verifications passed
              </span>
            </div>

            <div className="p-5 space-y-3.5 bg-white text-xs">
              <div className="flex items-start justify-between py-2 border-b border-[#E8E6DF]">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">MergeGuard / Contributor Reputation</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Status: <span className="text-emerald-700 font-semibold">Trusted</span> (Trust score: 95% backed by 3 verified recommendations)
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onEnterApp('contributors')}
                  className="text-indigo-600 hover:text-indigo-800 font-medium text-[11px]"
                >
                  Inspect Profile &rarr;
                </button>
              </div>

              <div className="flex items-start justify-between py-2 border-b border-[#E8E6DF]">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-800">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">MergeGuard / PR Authenticity & Evidence</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Provenance Hash: a7e3d994fc21... (Canonical GitHub API Record Verified)
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onEnterApp('evidence')}
                  className="text-indigo-600 hover:text-indigo-800 font-medium text-[11px]"
                >
                  View Evidence &rarr;
                </button>
              </div>

              <div className="flex items-start justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">MergeGuard / Security Alerts & Activity Scan</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      0 suspicious patterns or synchronized bursts detected across repositories.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onEnterApp('campaigns')}
                  className="text-indigo-600 hover:text-indigo-800 font-medium text-[11px]"
                >
                  Scan Details &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5 CORE PILLARS SECTION */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-b border-[#E8E6DF]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
            System Capabilities
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Trust Intelligence Built for Everyday Developers
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Simple to understand, verifiable by default, and engineered to keep your repositories secure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Pillar 1 */}
          <div className="mg-card-interactive p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                1. Repositories
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Connect your GitHub repositories in one click. Customize policies to decide minimum confidence levels and how contributor trust is evaluated.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E8E6DF] flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Policy Controls</span>
              <button
                onClick={() => onEnterApp('projects')}
                className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                <span>Repositories</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="mg-card-interactive p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                2. People & Fair Baselines
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Clear contributor profiles with an explicit fairness guarantee. First-time contributors start as New with an open baseline and are never assumed suspicious.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E8E6DF] flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Fairness Guaranteed</span>
              <button
                onClick={() => onEnterApp('contributors')}
                className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                <span>People</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="mg-card-interactive p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                3. Evidence & Recommendations
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Developers can recommend contributors based on verified work. Every signal requires a verifiable PR link and generates a tamper-evident record.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E8E6DF] flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Verified Work</span>
              <button
                onClick={() => onEnterApp('evidence')}
                className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                <span>Evidence</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="mg-card-interactive p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                4. Security Alerts
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Find unusual activity across repositories, such as synchronized spam pull requests, automated swarms, or repeated template text across projects.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E8E6DF] flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Pattern Scans</span>
              <button
                onClick={() => onEnterApp('campaigns')}
                className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                <span>Security Alerts</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Pillar 5 */}
          <div className="mg-card-interactive p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 mb-4">
                <Network className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                5. Trust Network
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Understand how verified contributor reputation connects across repositories. Explore visual links between maintainers, contributors, and projects.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E8E6DF] flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Reputation Graph</span>
              <button
                onClick={() => onEnterApp('network')}
                className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                <span>Trust Network</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Architecture / AI Integration */}
          <div className="mg-card-interactive p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                AI Review Summaries
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Open-weight AI summaries translate complex PR diffs and trust signals into clear, actionable checklists for repository maintainers.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#E8E6DF] flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Plain-English Summaries</span>
              <button
                onClick={() => onEnterApp('overview')}
                className="text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
              >
                <span>Overview</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="py-20 px-6 max-w-7xl mx-auto border-b border-[#E8E6DF]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">
            Workflow Overview
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            How Maintainers Use MergeGuard
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Connect Repository',
              desc: 'Enter your GitHub repo URL or connect via GitHub to sync PRs and verify contributor authenticity.',
            },
            {
              step: '02',
              title: 'Set Repository Policies',
              desc: 'Choose how strict you want your trust threshold to be and which peer projects you trust.',
            },
            {
              step: '03',
              title: 'Evaluate Pull Requests',
              desc: 'Check contributor trust status, recommendations, and verified work on incoming pull requests.',
            },
            {
              step: '04',
              title: 'Review Security Alerts',
              desc: 'Run real-time scans to detect synchronized spam or unusual patterns before merging code.',
            },
          ].map((item, idx) => (
            <div key={idx} className="mg-card p-6">
              <div className="font-mono text-2xl font-bold text-indigo-600 mb-3">{item.step}</div>
              <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-20 px-6 max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-extrabold text-slate-900">
          Ready to protect your pull request queue?
        </h2>
        <p className="mt-3 text-sm text-slate-600 max-w-xl mx-auto">
          Start verifying contributors and discovering cross-repository trust signals today.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onEnterApp('projects')}
            className="mg-btn-primary text-sm px-6 py-3"
          >
            <GithubIcon className="w-4 h-4 text-white" />
            <span>Connect a Repository Now</span>
          </button>
          <button
            onClick={() => onEnterApp('overview')}
            className="mg-btn-secondary text-sm px-6 py-3"
          >
            <span>Open Overview</span>
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#E8E6DF] bg-white py-10 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-900">MergeGuard</span>
            <span>&bull;</span>
            <span>Copyright &copy; 2026 Avi Garg. Licensed under Apache 2.0.</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <button
              onClick={() => onEnterApp('overview')}
              className="hover:text-indigo-600 transition-colors"
            >
              Overview
            </button>
            <button
              onClick={() => onEnterApp('network')}
              className="hover:text-indigo-600 transition-colors"
            >
              Trust Network
            </button>
            <button
              onClick={() => onEnterApp('campaigns')}
              className="hover:text-indigo-600 transition-colors"
            >
              Security Alerts
            </button>
            <a
              href="https://github.com/Garg-Avi/MergeGuard"
              target="_blank"
              rel="noreferrer"
              className="hover:text-indigo-600 transition-colors flex items-center gap-1.5"
            >
              <GithubIcon className="w-3.5 h-3.5 text-slate-600" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
