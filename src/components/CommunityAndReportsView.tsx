import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Flag,
  Megaphone,
  MessageSquarePlus,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ReportCategory } from '../types/campus';
import { VALID_REPORT_CATEGORIES } from '../utils/campusLogic';
import { queueOfflineAction } from '../utils/offlineCache';

export const CommunityAndReportsView: React.FC = () => {
  const {
    user,
    locations,
    communityItems,
    myReports,
    preselectedReportLocationId,
    refreshCampusData,
    refreshUserData,
    setActiveTab,
    isOnline,
    notify,
  } = useApp();

  const [subTab, setSubTab] = useState<'feed' | 'report'>(() =>
    preselectedReportLocationId ? 'report' : 'feed'
  );
  const [kindFilter, setKindFilter] = useState<'all' | 'event' | 'study-group' | 'announcement' | 'recommendation'>('all');

  // New Community Post
  const [postKind, setPostKind] = useState<'study-group' | 'recommendation' | 'event'>('study-group');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postLocationId, setPostLocationId] = useState('dusa-union');
  const [postingCommunity, setPostingCommunity] = useState(false);

  // Facility Report Form
  const [reportLocationId, setReportLocationId] = useState(
    preselectedReportLocationId || 'main-library'
  );
  const [reportCategory, setReportCategory] = useState<ReportCategory>('Faulty sockets');
  const [reportDescription, setReportDescription] = useState('');
  const [reportPhoto, setReportPhoto] = useState<string>('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (preselectedReportLocationId) {
      setReportLocationId(preselectedReportLocationId);
      setSubTab('report');
    }
  }, [preselectedReportLocationId]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) {
      notify('Please choose an image smaller than 400 KB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setReportPhoto(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      notify('Please sign in to post to the student community.', 'error');
      return;
    }
    setPostingCommunity(true);
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: postKind,
          title: postTitle,
          body: postBody,
          locationId: postLocationId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Could not publish post.', 'error');
      } else {
        setPostTitle('');
        setPostBody('');
        await refreshCampusData();
        notify('Community post published.', 'success');
      }
    } catch {
      notify('Network error publishing post.', 'error');
    } finally {
      setPostingCommunity(false);
    }
  };

  const handleJoinItem = async (id: string) => {
    if (!user) {
      notify('Sign in to RSVP or join a study group.', 'info');
      return;
    }
    const res = await fetch(`/api/community/${id}/join`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      await refreshCampusData();
      notify('Updated group/event participation.', 'success');
    }
  };

  const handleFlagItem = async (id: string) => {
    if (!user) {
      notify('Sign in to flag content for moderator review.', 'info');
      return;
    }
    const res = await fetch(`/api/community/${id}/flag`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      await refreshCampusData();
      notify('Flagged post for CampusPulse administrator review.', 'info');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      notify('Please sign in to submit a facility report.', 'error');
      return;
    }
    setSubmittingReport(true);
    const payload = {
      locationId: reportLocationId,
      category: reportCategory,
      description: reportDescription,
      photoDataUrl: reportPhoto || undefined,
    };

    if (!isOnline) {
      queueOfflineAction({
        endpoint: '/api/reports',
        method: 'POST',
        body: payload,
        label: `Facility report for ${reportLocationId}`,
      });
      setReportDescription('');
      setReportPhoto('');
      setSubmittingReport(false);
      notify('Saved facility report offline. It will sync when back online.', 'info');
      return;
    }

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Could not submit facility report.', 'error');
      } else {
        setReportDescription('');
        setReportPhoto('');
        await refreshUserData();
        notify('Facility report submitted to CampusPulse administrators.', 'success');
      }
    } catch {
      notify('Network error submitting report.', 'error');
    } finally {
      setSubmittingReport(false);
    }
  };

  const visibleFeed = communityItems.filter((c) =>
    kindFilter === 'all' ? true : c.kind === kindFilter
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            DUSA & Student Community
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Student events, study groups, recommendations, and campus facility reporting. Sample DUSA
            and student listings are explicitly marked as demonstration data until live feeds are connected.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('feed')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              subTab === 'feed'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Community & Events
          </button>
          <button
            type="button"
            onClick={() => setSubTab('report')}
            className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
              subTab === 'report'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Report Facility Issue
          </button>
        </div>
      </div>

      {subTab === 'feed' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Feed Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter community items">
              {[
                { id: 'all', label: 'All' },
                { id: 'event', label: 'Events' },
                { id: 'study-group', label: 'Study Groups' },
                { id: 'announcement', label: 'Announcements' },
                { id: 'recommendation', label: 'Recommendations' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setKindFilter(t.id as typeof kindFilter)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
                    kindFilter === t.id
                      ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {visibleFeed.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3 cp-card-3d"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 capitalize font-medium text-[#1D4ED8] dark:text-sky-400">
                    {item.kind === 'announcement' ? (
                      <Megaphone className="w-3.5 h-3.5" />
                    ) : item.kind === 'study-group' ? (
                      <Users className="w-3.5 h-3.5" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5" />
                    )}
                    {item.kind.replace('-', ' ')}
                  </span>
                  <span>
                    {item.isDemoData ? 'Demonstration Data · ' : ''}
                    Posted by {item.authorName}
                  </span>
                </div>

                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {item.title}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.body}
                </p>

                {item.locationName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Location: <strong>{item.locationName}</strong>
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {(item.kind === 'event' || item.kind === 'study-group') && (
                      <button
                        type="button"
                        onClick={() => handleJoinItem(item.id)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                      >
                        {item.kind === 'study-group' ? 'Join Group' : 'RSVP'} (
                        <span className="tabular-nums">{item.participantsCount ?? 0}</span>)
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFlagItem(item.id)}
                    aria-label={`Flag ${item.title} for moderation`}
                    className="inline-flex items-center gap-1 min-h-[40px] px-3 py-1.5 rounded-xl text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Report Content
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Post Form & DUSA Destination Card */}
          <aside className="lg:col-span-5 space-y-6">
            <div className="group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden cp-card-3d">
              <div className="h-40 overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src="/src/assets/images/dusa_student_hub_1795118447976.jpg"
                  alt="Student union social and collaborative seating"
                  className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-5 space-y-2">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  DUSA — Verified Campus Destination
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Dundee University Students&apos; Association (Airlie Place / Balfour Street) is featured
                  as a verified City Campus destination. CampusPulse is an independent student app and
                  does not claim an official DUSA partnership.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleCreatePost}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-5 h-5 text-[#1D4ED8] dark:text-sky-400" />
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Share Study Group or Tip
                </h2>
              </div>

              {!user && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Please{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('account')}
                    className="underline font-semibold"
                  >
                    sign in
                  </button>{' '}
                  to publish community updates.
                </p>
              )}

              <div>
                <label htmlFor="comm-kind" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  id="comm-kind"
                  value={postKind}
                  onChange={(e) => setPostKind(e.target.value as typeof postKind)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  <option value="study-group">Study Group</option>
                  <option value="recommendation">Student Recommendation</option>
                  <option value="event">Student Activity / Event</option>
                </select>
              </div>

              <div>
                <label htmlFor="comm-location" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  City Campus Location
                </label>
                <select
                  id="comm-location"
                  value={postLocationId}
                  onChange={(e) => setPostLocationId(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="comm-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  id="comm-title"
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g., CS32005 Study Group — Main Library"
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label htmlFor="comm-body" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Details
                </label>
                <textarea
                  id="comm-body"
                  required
                  rows={3}
                  value={postBody}
                  onChange={(e) => setPostBody(e.target.value)}
                  placeholder="Share time, room/area, and what you are studying..."
                  className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={postingCommunity || !user}
                className="w-full min-h-[44px] rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {postingCommunity ? 'Publishing...' : 'Publish to Community'}
              </button>
            </form>
          </aside>
        </div>
      ) : (
        /* Facility Issue Reporting */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSubmitReport}
            className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#1D4ED8] dark:text-sky-400" />
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Submit Campus Facility Report
              </h2>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl leading-relaxed">
              <strong>Important Notice:</strong> Facility reports submitted here are reviewed by{' '}
              <strong>CampusPulse project administrators</strong>. They are{' '}
              <strong>not</strong> automatically sent to University of Dundee Estates unless an
              official integration is configured.
            </p>

            {!user && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Please{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('account')}
                  className="underline font-semibold"
                >
                  sign in
                </button>{' '}
                to submit and track facility reports.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="report-location" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Campus Location
                </label>
                <select
                  id="report-location"
                  value={reportLocationId}
                  onChange={(e) => setReportLocationId(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="report-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Issue Category
                </label>
                <select
                  id="report-category"
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value as ReportCategory)}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  {VALID_REPORT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="report-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description (minimum 10 characters)
              </label>
              <textarea
                id="report-desc"
                required
                minLength={10}
                rows={4}
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Describe the exact floor, room or issue (e.g., faulty power socket, step-free door obstruction)..."
                className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
            </div>

            <div>
              <label htmlFor="report-photo" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Optional Photograph (max 400 KB)
              </label>
              <input
                id="report-photo"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="text-xs text-slate-600 dark:text-slate-300"
              />
            </div>

            <button
              type="submit"
              disabled={submittingReport || !user}
              className="w-full min-h-[44px] rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submittingReport ? 'Submitting Report...' : 'Submit Facility Report'}
            </button>
          </form>

          {/* My Submitted Reports */}
          <aside className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Your Submitted Reports
            </h2>
            {myReports.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {user ? 'No facility reports submitted yet.' : 'Sign in to view your submitted reports.'}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {myReports.map((rep) => (
                  <div key={rep.id} className="py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#1D4ED8] dark:text-sky-400">
                        {rep.status}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {new Date(rep.createdAt).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {rep.locationName} · {rep.category}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{rep.description}</p>
                    {rep.adminNotes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        Admin note: {rep.adminNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
