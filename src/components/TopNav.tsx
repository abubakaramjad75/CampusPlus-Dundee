import React from 'react';
import { QrCode, ShieldCheck, UserCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ActiveTab } from '../types/campus';

export const TopNav: React.FC = () => {
  const { activeTab, setActiveTab, user, activeCheckIn } = useApp();

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'study', label: 'Study Spaces' },
    { id: 'map', label: 'Campus Map' },
    { id: 'community', label: 'Community' },
    { id: 'account', label: user ? 'Account' : 'Sign In' },
  ];

  return (
    <header className="sticky top-0 z-30 h-14 md:h-16 bg-white/95 dark:bg-[#0B1B3B]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-sky-500 rounded-lg py-1"
          aria-label="CampusPulse Dundee Home"
        >
          <img
            src="/src/assets/images/campuspulse_logo_1795118447017.jpg"
            alt="CampusPulse Dundee logo"
            className="w-8 h-8 rounded-lg object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="font-display text-base sm:text-lg font-bold tracking-tight text-[#0B1B3B] dark:text-white whitespace-nowrap shrink-0">
            CampusPulse Dundee
          </span>
        </button>

        {/* Zone 2: Desktop single-line navigation links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 ${
                  isActive
                    ? 'text-[#1D4ED8] dark:text-sky-400'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-[#1D4ED8] dark:bg-sky-400 rounded-full"
                  />
                )}
              </button>
            );
          })}
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`relative py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 ${
                activeTab === 'admin'
                  ? 'text-[#1D4ED8] dark:text-sky-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Admin
              {activeTab === 'admin' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-[#1D4ED8] dark:bg-sky-400 rounded-full"
                />
              )}
            </button>
          )}
        </nav>

        {/* Zone 3: Single Primary Action (Desktop) / Compact Account trigger (Mobile) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            aria-label={user ? `Account settings for ${user.displayName}` : 'Sign in or settings'}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {user?.role === 'admin' ? (
              <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            ) : (
              <UserCircle2 className="w-5 h-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className="hidden md:inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-sm font-medium whitespace-nowrap shrink-0 hover:bg-[#132957] dark:hover:bg-sky-500 transition focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span>{activeCheckIn ? 'Active Check-In' : 'QR Check-In'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
