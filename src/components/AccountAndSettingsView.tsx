import React, { useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  MailCheck,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useApp, type TextScale } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

export const AccountAndSettingsView: React.FC = () => {
  const {
    user,
    setUser,
    signInWithGoogle,
    logoutAll,
    theme,
    toggleTheme,
    textScale,
    setTextScale,
    setActiveTab,
    notify,
    firestoreConnected,
  } = useApp();

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [courseOrSubject, setCourseOrSubject] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [demoTokenNote, setDemoTokenNote] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Verification
  const [verifyTokenInput, setVerifyTokenInput] = useState('');

  // Profile Edit State
  const [editName, setEditName] = useState(user?.displayName || '');
  const [editCourse, setEditCourse] = useState(user?.courseOrSubject || '');
  const [editAccess, setEditAccess] = useState(user?.accessibilityPreferences || '');
  const [editStudyPrefs, setEditStudyPrefs] = useState<string[]>(user?.studyPreferences || []);
  const [editAvatar, setEditAvatar] = useState(user?.avatarUrl || '');
  const [allowGps, setAllowGps] = useState(user?.privacyPreferences.allowGpsNavigation ?? true);
  const [anonOcc, setAnonOcc] = useState(user?.privacyPreferences.anonymousOccupancyReports ?? false);
  const [notifAnn, setNotifAnn] = useState(user?.notificationPreferences.campusAnnouncements ?? true);
  const [notifStudy, setNotifStudy] = useState(user?.notificationPreferences.studySpaceAlerts ?? true);
  const [notifRep, setNotifRep] = useState(user?.notificationPreferences.reportUpdates ?? true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  React.useEffect(() => {
    if (user) {
      setEditName(user.displayName);
      setEditCourse(user.courseOrSubject);
      setEditAccess(user.accessibilityPreferences);
      setEditStudyPrefs(user.studyPreferences);
      setEditAvatar(user.avatarUrl || '');
      setAllowGps(user.privacyPreferences.allowGpsNavigation);
      setAnonOcc(user.privacyPreferences.anonymousOccupancyReports);
      setNotifAnn(user.notificationPreferences.campusAnnouncements);
      setNotifStudy(user.notificationPreferences.studySpaceAlerts);
      setNotifRep(user.notificationPreferences.reportUpdates);
    }
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Login failed.', 'error');
      } else {
        setUser(json.user);
        notify(`Signed in as ${json.user.displayName}.`, 'success');
      }
    } catch {
      notify('Network error signing in.', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, displayName, courseOrSubject }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Registration failed.', 'error');
      } else {
        setUser(json.user);
        if (json.demoVerificationToken) {
          setDemoTokenNote(`Verification token for testing: ${json.demoVerificationToken}`);
          setVerifyTokenInput(json.demoVerificationToken);
        }
        notify('Account registered successfully.', 'success');
      }
    } catch {
      notify('Network error during registration.', 'error');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.demoResetToken) {
        setDemoTokenNote(`Reset code (valid 30m): ${json.demoResetToken}`);
        setResetToken(json.demoResetToken);
        setAuthMode('reset');
      }
      notify(json.message || 'Check reset instructions.', 'info');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: resetToken, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Password reset failed.', 'error');
      } else {
        setAuthMode('login');
        setDemoTokenNote(null);
        notify('Password updated. Please sign in.', 'success');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleVerifyEmail = async () => {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token: verifyTokenInput }),
    });
    const json = await res.json();
    if (!res.ok) {
      notify(json.error || 'Verification failed.', 'error');
    } else {
      setUser(json.user);
      setDemoTokenNote(null);
      notify('Email verified!', 'success');
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200_000) {
      notify('Profile photo must be smaller than 200 KB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditAvatar(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          displayName: editName,
          courseOrSubject: editCourse,
          accessibilityPreferences: editAccess,
          studyPreferences: editStudyPrefs,
          avatarUrl: editAvatar,
          privacyPreferences: {
            allowGpsNavigation: allowGps,
            anonymousOccupancyReports: anonOcc,
          },
          notificationPreferences: {
            campusAnnouncements: notifAnn,
            studySpaceAlerts: notifStudy,
            reportUpdates: notifRep,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Could not update profile.', 'error');
      } else {
        setUser(json.user);
        notify('Profile & preferences saved.', 'success');
      }
    } catch {
      notify('Network error saving profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    const res = await fetch('/api/auth/account', {
      method: 'DELETE',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) {
      notify(json.error || 'Could not delete account.', 'error');
    } else {
      setUser(null);
      setConfirmDelete(false);
      notify('Your account and personal data have been permanently deleted.', 'info');
    }
  };

  const studyPrefOptions = [
    'Quiet study',
    'Group tables',
    'Power sockets',
    'Accessible access',
    'Natural daylight',
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Account, Accessibility & Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          CampusPulse Dundee does not verify official University of Dundee student status — accounts
          are solely for CampusPulse study check-ins, saved preferences, and facility reports.
        </p>
      </div>

      {/* Accessibility & Display Preferences (Available Signed In or Out) */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 cp-card-3d">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Appearance & Accessibility
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Switch between light and dark themes or adjust text size for readability.
            </p>
          </div>
          <PWAInstallButton />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Theme Mode</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Currently {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-xs font-semibold"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Text Size</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Adjustable typography scale</p>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Text size selector">
              {(['normal', 'large', 'xlarge'] as TextScale[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTextScale(s)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    textScale === s
                      ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {s === 'normal' ? '100%' : s === 'large' ? '112%' : '122%'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {!user ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Auth Form */}
          <section className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-semibold ${
                  authMode === 'login'
                    ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-semibold ${
                  authMode === 'register'
                    ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('forgot')}
                className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-semibold ${
                  authMode === 'forgot' || authMode === 'reset'
                    ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                Reset Password
              </button>
            </div>

            {demoTokenNote && (
              <p className="text-xs font-mono bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 p-3 rounded-xl text-sky-900 dark:text-sky-200">
                {demoTokenNote}
              </p>
            )}

            {authMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium mb-1">
                    Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@campuspulse.test"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-xs font-medium mb-1">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full min-h-[44px] rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-blue-700"
                >
                  {authBusy ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            )}

            {authMode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-medium mb-1">
                    Display Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g., Isla Stewart"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="reg-email" className="block text-xs font-medium mb-1">
                    Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="reg-course" className="block text-xs font-medium mb-1">
                    Course or Subject Area (optional)
                  </label>
                  <input
                    id="reg-course"
                    type="text"
                    value={courseOrSubject}
                    onChange={(e) => setCourseOrSubject(e.target.value)}
                    placeholder="e.g., BSc Computing Science"
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="reg-password" className="block text-xs font-medium mb-1">
                    Password (minimum 8 characters)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Student Account
                </button>
              </form>
            )}

            {authMode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-medium mb-1">
                    Account Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full min-h-[44px] rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-sm font-semibold"
                >
                  Generate Password Reset Code
                </button>
              </form>
            )}

            {authMode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="reset-token" className="block text-xs font-medium mb-1">
                    Reset Token
                  </label>
                  <input
                    id="reset-token"
                    type="text"
                    required
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="reset-new-pw" className="block text-xs font-medium mb-1">
                    New Password
                  </label>
                  <input
                    id="reset-new-pw"
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold"
                >
                  <KeyRound className="w-4 h-4" />
                  Confirm Password Reset
                </button>
              </form>
            )}
          </section>

          {/* Firebase Google Sign-In & Demo Credentials */}
          <aside className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Firebase Google Sign-In
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Sign in with Google via Firebase Authentication to sync study profiles and occupancy
                records to Cloud Firestore ({firestoreConnected ? 'Firestore reachable' : 'Ready'}).
              </p>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Continue with Google (Firebase Auth)
              </button>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Assessment Test Accounts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quick-fill seeded test credentials to evaluate student or server-controlled admin roles:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setEmail('student@campuspulse.test');
                    setPassword('StudentDundee2026!');
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium"
                >
                  Fill Student Demo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setEmail('admin@campuspulse.test');
                    setPassword('AdminDundee2026!');
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium"
                >
                  Fill Admin Demo
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        /* Signed-In Profile Editor & Controls */
        <div className="space-y-6">
          <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {editAvatar ? (
                <img
                  src={editAvatar}
                  alt={user.displayName}
                  className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#0B1B3B] dark:bg-sky-600 text-white flex items-center justify-center font-display text-xl font-bold">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {user.displayName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {user.email} · Role: {user.role === 'admin' ? 'Administrator' : 'Student'} ·{' '}
                  {user.emailVerified ? 'Email verified' : 'Email pending verification'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-xs font-semibold"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Open Admin Dashboard
                </button>
              )}
              <button
                type="button"
                onClick={logoutAll}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </section>

          {/* Email Verification Panel if unverified */}
          {!user.emailVerified && (
            <section className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-sm">
                <MailCheck className="w-4 h-4" />
                Verify Your Email Address
              </div>
              {demoTokenNote && (
                <p className="text-xs font-mono text-amber-900 dark:text-amber-200">{demoTokenNote}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={verifyTokenInput}
                  onChange={(e) => setVerifyTokenInput(e.target.value)}
                  placeholder="Enter verification code"
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleVerifyEmail}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-xs font-semibold"
                >
                  Verify Email
                </button>
              </div>
            </section>
          )}

          {/* Profile & Privacy Editor */}
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5"
          >
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Profile, Privacy & Notification Settings
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="prof-name" className="block text-xs font-medium mb-1">
                  Display Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label htmlFor="prof-course" className="block text-xs font-medium mb-1">
                  Course or Subject Area
                </label>
                <input
                  id="prof-course"
                  type="text"
                  value={editCourse}
                  onChange={(e) => setEditCourse(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="prof-access" className="block text-xs font-medium mb-1">
                Accessibility Preferences (optional, stored privately)
              </label>
              <input
                id="prof-access"
                type="text"
                value={editAccess}
                onChange={(e) => setEditAccess(e.target.value)}
                placeholder="e.g., Step-free routes, lift access"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div>
              <p className="text-xs font-medium mb-2">Study Preferences</p>
              <div className="flex flex-wrap gap-2">
                {studyPrefOptions.map((opt) => {
                  const selected = editStudyPrefs.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setEditStudyPrefs((prev) =>
                          prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
                        )
                      }
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                        selected
                          ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="prof-avatar" className="block text-xs font-medium mb-1">
                Optional Profile Picture (max 200 KB)
              </label>
              <input
                id="prof-avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Privacy Controls</p>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={allowGps}
                    onChange={(e) => setAllowGps(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span>Allow GPS campus navigation</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={anonOcc}
                    onChange={(e) => setAnonOcc(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span>Default to pseudonymous occupancy updates</span>
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Notification Preferences
                </p>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={notifAnn}
                    onChange={(e) => setNotifAnn(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span>Campus announcements</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={notifStudy}
                    onChange={(e) => setNotifStudy(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span>Study space alerts</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={notifRep}
                    onChange={(e) => setNotifRep(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span>Facility report status updates</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-blue-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>

              {user.role !== 'admin' && (
                <div>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Account
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold"
                      >
                        Confirm Permanent Deletion
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs text-slate-600 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
