import React from 'react';
import { X } from 'lucide-react';
import { AccountAndSettingsView } from './components/AccountAndSettingsView';
import { AdminDashboard } from './components/AdminDashboard';
import { CampusMapView } from './components/CampusMapView';
import { CommunityAndReportsView } from './components/CommunityAndReportsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeDashboard } from './components/HomeDashboard';
import { MobileTabBar } from './components/MobileTabBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { QrScannerView } from './components/QrScannerView';
import { StudySpaceFinder } from './components/StudySpaceFinder';
import { TopNav } from './components/TopNav';
import { AppProvider, useApp } from './context/AppContext';

const ToastRack: React.FC = () => {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto cp-toast-enter rounded-xl px-4 py-3 text-xs font-medium shadow-lg border flex items-center justify-between gap-3 ${
            t.tone === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : t.tone === 'success'
                ? 'bg-[#0B1B3B] text-white border-sky-700'
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700'
          }`}
        >
          <span>{t.text}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg hover:bg-black/10 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

const MainShell: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#09111F] text-slate-900 dark:text-slate-100">
      <TopNav />
      <OfflineIndicator />

      <main className="flex-1 pb-24 md:pb-12 cp-perspective overflow-x-clip">
        <div key={activeTab} className="cp-page-enter">
          {activeTab === 'home' && <HomeDashboard />}
          {activeTab === 'study' && <StudySpaceFinder />}
          {activeTab === 'scan' && <QrScannerView />}
          {activeTab === 'map' && <CampusMapView />}
          {activeTab === 'community' && <CommunityAndReportsView />}
          {activeTab === 'account' && <AccountAndSettingsView />}
          {activeTab === 'admin' && <AdminDashboard />}
        </div>
      </main>

      <footer className="hidden md:block border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1B3B]/40 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>
            CampusPulse Dundee · CS32005 Mobile Application Development · Independent Student Project
            (University of Dundee City Campus).
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              Accessibility & Privacy
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('community')}
              className="hover:text-slate-900 dark:hover:text-white"
            >
              Report Facility Issue
            </button>
          </div>
        </div>
      </footer>

      <MobileTabBar />
      <ToastRack />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
