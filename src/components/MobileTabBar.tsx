import React from 'react';
import { BookOpen, Home, MapPin, QrCode, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ActiveTab } from '../types/campus';

export const MobileTabBar: React.FC = () => {
  const { activeTab, setActiveTab, activeCheckIn } = useApp();

  const tabs: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'study', label: 'Study', icon: BookOpen },
    { id: 'scan', label: activeCheckIn ? 'Checked' : 'Scan QR', icon: QrCode },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'community', label: 'Community', icon: Users },
  ];

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 pb-safe bg-white/95 dark:bg-[#0B1B3B]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-1 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 ${
              isActive
                ? 'text-[#1D4ED8] dark:text-sky-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
