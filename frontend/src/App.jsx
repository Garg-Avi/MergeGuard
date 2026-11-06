import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './layouts/DashboardLayout';
import OverviewView from './pages/OverviewView';
import TrustNetworkGraph from './graph/TrustNetworkGraph';
import ContributorsView from './pages/ContributorsView';
import ProjectsView from './pages/ProjectsView';
import VouchesView from './pages/VouchesView';
import DenouncementsView from './pages/DenouncementsView';
import CampaignsView from './pages/CampaignsView';
import EvidenceCenterView from './pages/EvidenceCenterView';
import SettingsView from './pages/SettingsView';
import AdminActivityView from './pages/AdminActivityView';
import AuthModal from './components/AuthModal';
import { api } from './services/api';

export default function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [aiStatus, setAiStatus] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    // Check local storage for existing session
    try {
      const storedUser = localStorage.getItem('mergeguard_user');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch {
      // ignore
    }

    async function checkStatus() {
      try {
        const status = await api.getAIStatus();
        setAiStatus(status);
      } catch (e) {
        console.warn('AI status check failed, using deterministic mode:', e);
        setAiStatus({
          model_name: 'GPT-OSS-120B',
          is_live_configured: false,
          mode: 'Deterministic Fallback Active',
        });
      }
    }
    checkStatus();
  }, []);

  const handleNavigate = (view) => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await api.logout().catch(() => {});
    } finally {
      localStorage.removeItem('mergeguard_token');
      localStorage.removeItem('mergeguard_user');
      localStorage.removeItem('mergeguard_admin_key');
      setCurrentUser(null);
    }
  };

  // If on Landing Page
  if (currentView === 'landing') {
    return <LandingPage onEnterApp={(target) => handleNavigate(target || 'overview')} />;
  }

  // Dashboard Views
  return (
    <>
      <DashboardLayout
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenLanding={() => handleNavigate('landing')}
        aiStatus={aiStatus}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      >
        {currentView === 'overview' && <OverviewView onNavigate={handleNavigate} />}
        {currentView === 'network' && (
          <div className="space-y-6 animate-fade-in-up font-sans">
            <div className="pb-6 border-b border-[#E8E6DF]">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Interactive Trust Network
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Multi-repository topological graph powered by React Flow. Inspect peer endorsements, allegations, and consensus provenance.
              </p>
            </div>
            <TrustNetworkGraph
              onSelectContributor={() => handleNavigate('contributors')}
              onSelectProject={() => handleNavigate('projects')}
            />
          </div>
        )}
        {currentView === 'contributors' && <ContributorsView />}
        {currentView === 'projects' && <ProjectsView />}
        {currentView === 'vouches' && <VouchesView />}
        {currentView === 'denouncements' && <DenouncementsView />}
        {currentView === 'campaigns' && <CampaignsView />}
        {currentView === 'evidence' && <EvidenceCenterView />}
        {currentView === 'admin' && <AdminActivityView onOpenAuth={() => setAuthModalOpen(true)} />}
        {currentView === 'settings' && <SettingsView aiStatus={aiStatus} />}
      </DashboardLayout>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    </>
  );
}
