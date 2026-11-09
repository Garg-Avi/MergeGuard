import React, { useState } from 'react';
import {
  Shield,
  Network,
  Users,
  FolderGit2,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  ExternalLink,
  Cpu,
  ArrowUpRight,
  Activity,
  LogOut,
  UserCheck,
} from 'lucide-react';

export default function DashboardLayout({
  currentView,
  onNavigate,
  onOpenLanding,
  aiStatus,
  currentUser,
  onOpenAuth,
  onLogout,
  children,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navSections = [
    {
      title: 'Navigation',
      items: [
        { id: 'overview', label: 'Overview', icon: Shield },
        { id: 'network', label: 'Trust Network', icon: Network },
        { id: 'contributors', label: 'People', icon: Users },
        { id: 'projects', label: 'Repositories', icon: FolderGit2 },
      ],
    },
    {
      title: 'Community & Trust',
      items: [
        { id: 'vouches', label: 'Recommendations', icon: CheckCircle2 },
        { id: 'denouncements', label: 'Reports', icon: AlertTriangle },
        { id: 'campaigns', label: 'Security Alerts', icon: Flame },
        { id: 'evidence', label: 'Evidence', icon: FileText },
      ],
    },
    {
      title: 'System',
      items: [
        { id: 'admin', label: 'Admin Activity', icon: Activity },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const viewLabels = {
    overview: 'Overview',
    network: 'Trust Network',
    contributors: 'People',
    projects: 'Repositories',
    vouches: 'Recommendations',
    denouncements: 'Reports',
    campaigns: 'Security Alerts',
    evidence: 'Evidence',
    admin: 'Admin Activity',
    settings: 'Settings',
  };

  return (
    <div className="flex h-screen bg-[#090A0C] text-[#B0B3BA] overflow-hidden font-sans">
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col border-r border-[#2B2E35] bg-[#111318] transition-all duration-200 ease-in-out shadow-xs ${
          collapsed ? 'w-18' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#2B2E35]">
          <div
            className="flex items-center gap-3 cursor-pointer overflow-hidden select-none"
            onClick={onOpenLanding}
            title="MergeGuard — Home"
          >
            <div className="w-9 h-9 rounded-xl bg-[#202329] border border-[#2B2E35] flex items-center justify-center text-[#D69B45] shrink-0 shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="truncate">
                <div className="font-bold text-sm text-[#F5F5F5] tracking-tight flex items-center gap-1.5 leading-none">
                  MergeGuard
                </div>
                <div className="text-[10px] text-[#777D87] font-medium tracking-normal mt-1 leading-none">
                  Trust & Threat Intelligence
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-[#777D87] hover:text-[#F5F5F5] hover:bg-[#202329] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!collapsed && (
                <div className="px-3 pb-1 text-[10px] font-semibold text-[#777D87] uppercase tracking-wider">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#202329] text-[#F5F5F5] font-semibold border border-[#D69B45]/40 shadow-xs'
                        : 'text-[#B0B3BA] hover:text-[#F5F5F5] hover:bg-[#17191F] border border-transparent'
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-[#D69B45]' : 'text-[#777D87]'
                      }`}
                    />
                    {!collapsed && (
                      <div className="flex items-center justify-between flex-1 truncate">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[#202329] text-[#B0B3BA] font-semibold border border-[#2B2E35]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Info Box */}
        <div className="p-3.5 border-t border-[#2B2E35] bg-[#111318]">
          {!collapsed ? (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-[#17191F] border border-[#2B2E35] text-xs shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono flex items-center gap-1.5 text-[#F5F5F5] font-medium">
                    <Cpu className="w-3.5 h-3.5 text-[#777D87]" />
                    <span>{aiStatus?.model_name || 'GPT-OSS-120B'}</span>
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" title="Runtime ready" />
                </div>
                <div className="text-[10px] text-[#777D87] mt-1 truncate">
                  {aiStatus?.mode || 'Deterministic Engine'}
                </div>
              </div>

              <button
                onClick={onOpenLanding}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[#B0B3BA] hover:text-[#F5F5F5] hover:bg-[#202329] text-xs transition-colors"
              >
                <span>Product Home</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLanding}
              title="Return to Product Home"
              className="w-full p-2 flex justify-center text-[#777D87] hover:text-[#F5F5F5] rounded-xl hover:bg-[#202329]"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-[#2B2E35] bg-[#111318]/90 backdrop-blur-md px-6 sm:px-8 flex items-center justify-between gap-4 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-[#B0B3BA] hover:text-[#F5F5F5] hover:bg-[#202329] rounded-lg"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="text-xs text-[#777D87] flex items-center gap-2 font-medium">
              <span
                className="hover:text-[#F5F5F5] cursor-pointer text-[#B0B3BA]"
                onClick={() => onNavigate('overview')}
              >
                Garg-Avi
              </span>
              <span>/</span>
              <span
                className="text-[#F5F5F5] font-semibold hover:text-white cursor-pointer"
                onClick={() => onNavigate('overview')}
              >
                MergeGuard
              </span>
              <span>/</span>
              <span className="text-[#F5F5F5] bg-[#202329] border border-[#2B2E35] px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                {viewLabels[currentView] || currentView.replace('-', ' ')}
              </span>
            </div>
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#17191F] border border-[#2B2E35] text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[#F5F5F5] font-medium max-w-[140px] truncate">
                    {currentUser.name || currentUser.email}
                  </span>
                  {currentUser.is_admin && (
                    <span className="px-1.5 py-0.2 rounded-md bg-[#202329] text-[#B0B3BA] font-mono text-[9px] font-semibold border border-[#2B2E35]">
                      ADMIN
                    </span>
                  )}
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl bg-[#17191F] border border-[#2B2E35] text-[#777D87] hover:text-rose-400 hover:bg-rose-950/30 transition-colors shadow-xs"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="mg-btn-secondary text-xs"
              >
                <UserCheck className="w-4 h-4 text-[#777D87]" />
                <span>Sign in / Admin</span>
              </button>
            )}

            <button
              onClick={onOpenLanding}
              className="mg-btn-secondary text-xs hidden sm:inline-flex"
            >
              <span>Landing Page</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#777D87]" />
            </button>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#090A0C]">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
