import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Search,
  Users,
} from 'lucide-react';
import { DUNDEE_CITY_CAMPUS_CENTER } from '../data/dundeeLocations';
import { useApp } from '../context/AppContext';
import { syncOccupancyToFirestore } from '../firebase/client';
import type { OccupancyLevel, StudySpaceSummary } from '../types/campus';
import {
  calculateDistanceMeters,
  filterStudySpaces,
  formatDistanceLabel,
} from '../utils/campusLogic';
import { queueOfflineAction } from '../utils/offlineCache';

export const StudySpaceFinder: React.FC = () => {
  const {
    studySpaces,
    userCoords,
    favouriteIds,
    toggleFavourite,
    openLocationOnMap,
    refreshCampusData,
    user,
    isOnline,
    notify,
  } = useApp();

  const [query, setQuery] = useState('');
  const [quietOnly, setQuietOnly] = useState(false);
  const [groupOnly, setGroupOnly] = useState(false);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [socketsOnly, setSocketsOnly] = useState(false);
  const [seatingOnly, setSeatingOnly] = useState(false);

  const [reportingSpace, setReportingSpace] = useState<StudySpaceSummary | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<Exclude<OccupancyLevel, 'Unknown'>>('Low');
  const [submitAnon, setSubmitAnon] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const origin = userCoords ?? DUNDEE_CITY_CAMPUS_CENTER;

  const filtered = useMemo(
    () =>
      filterStudySpaces(studySpaces, {
        query,
        quietOnly,
        groupOnly,
        accessibleOnly,
        wifiOnly,
        socketsOnly,
        seatingOnly,
      }),
    [studySpaces, query, quietOnly, groupOnly, accessibleOnly, wifiOnly, socketsOnly, seatingOnly]
  );

  const handleReportOccupancy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingSpace) return;
    setSubmitting(true);

    const payload = {
      locationId: reportingSpace.id,
      level: selectedLevel,
      anonymous: submitAnon,
    };

    if (!isOnline) {
      queueOfflineAction({
        endpoint: '/api/occupancy',
        method: 'POST',
        body: payload,
        label: `Occupancy report (${selectedLevel}) for ${reportingSpace.name}`,
      });
      notify('Saved occupancy update offline. It will sync automatically when online.', 'info');
      setReportingSpace(null);
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/occupancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        notify(json.error || 'Could not submit occupancy update.', 'error');
      } else {
        await syncOccupancyToFirestore(
          reportingSpace.id,
          selectedLevel,
          reportingSpace.activeCheckIns,
          submitAnon || !user ? 'Anonymous student' : user.displayName
        ).catch(() => undefined);
        await refreshCampusData();
        notify(`Updated ${reportingSpace.name} community occupancy to ${selectedLevel}.`, 'success');
        setReportingSpace(null);
      }
    } catch {
      notify('Network error while submitting occupancy report.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filterButtons = [
    { label: 'Quiet Study', active: quietOnly, toggle: () => setQuietOnly((v) => !v) },
    { label: 'Group Study', active: groupOnly, toggle: () => setGroupOnly((v) => !v) },
    { label: 'Verified Accessible', active: accessibleOnly, toggle: () => setAccessibleOnly((v) => !v) },
    { label: 'Verified Wi-Fi', active: wifiOnly, toggle: () => setWifiOnly((v) => !v) },
    { label: 'Power Sockets', active: socketsOnly, toggle: () => setSocketsOnly((v) => !v) },
    { label: 'Verified Seating', active: seatingOnly, toggle: () => setSeatingOnly((v) => !v) },
  ];

  const occupancyTextClass = (level: OccupancyLevel) => {
    if (level === 'Low') return 'text-emerald-700 dark:text-emerald-400';
    if (level === 'Medium') return 'text-amber-700 dark:text-amber-400';
    if (level === 'Busy') return 'text-rose-700 dark:text-rose-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Dundee Smart Study Space Finder
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
            Prioritises verified City Campus study spaces starting with the Main Library on Smalls Wynd.
            Occupancy levels are community-reported or calculated from voluntary CampusPulse check-ins —{' '}
            <strong>not official live University data</strong>.
          </p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div className="relative">
          <label htmlFor="study-search" className="sr-only">
            Search study spaces
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="study-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by building, Smalls Wynd, quiet rooms, sockets..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-2 focus:outline-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Study space filters">
          {filterButtons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              aria-pressed={btn.active}
              onClick={btn.toggle}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition ${
                btn.active
                  ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No verified City Campus study spaces matched all selected filters. Note: facilities like
            power sockets are only flagged where verified from official University documentation.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setQuietOnly(false);
              setGroupOnly(false);
              setAccessibleOnly(false);
              setWifiOnly(false);
              setSocketsOnly(false);
              setSeatingOnly(false);
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-sm font-medium"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((space) => {
            const dist = calculateDistanceMeters(origin.lat, origin.lng, space.lat, space.lng);
            const isFav = favouriteIds.includes(space.id);
            return (
              <article
                key={space.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-4 cp-card-3d"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {space.streetContext} · {space.accessLevel} ·{' '}
                        <span className="tabular-nums">{formatDistanceLabel(dist)}</span>
                      </p>
                      <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {space.name}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFavourite(space.id)}
                      aria-label={isFav ? `Remove ${space.name} from favourites` : `Favourite ${space.name}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Bookmark
                        className={`w-5 h-5 ${
                          isFav ? 'fill-current text-[#1D4ED8] dark:text-sky-400' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Occupancy Readout */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm py-2.5 border-y border-slate-100 dark:border-slate-800">
                    <span className={`inline-flex items-center gap-1.5 font-semibold ${occupancyTextClass(space.occupancy)}`}>
                      {space.occupancy === 'Low' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <Users className="w-4 h-4 shrink-0" />
                      )}
                      Reported Occupancy: {space.occupancy}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      {space.lastUpdatedAt
                        ? `Updated ${new Date(space.lastUpdatedAt).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'No recent reports'}
                    </span>

                    {space.isStale && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Information may be outdated
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {space.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <p>
                      <strong>Facilities:</strong> {space.verifiedFacilities.join(' · ')}
                    </p>
                    <p>
                      <strong>Accessibility:</strong> {space.accessibilityInfo}
                    </p>
                    <p>
                      <strong>Access note:</strong> {space.accessNote}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReportingSpace(space);
                        setSelectedLevel('Low');
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-xs font-semibold hover:opacity-95 transition"
                    >
                      Report Occupancy
                    </button>
                    <button
                      type="button"
                      onClick={() => openLocationOnMap(space.id)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Compass className="w-4 h-4" />
                      Navigate
                    </button>
                  </div>
                  <a
                    href={space.officialReferenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1D4ED8] dark:text-sky-400 hover:underline min-h-[40px]"
                  >
                    Official Info
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Occupancy Submission Modal */}
      {reportingSpace && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="occ-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
        >
          <form
            onSubmit={handleReportOccupancy}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4"
          >
            <h3 id="occ-modal-title" className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Update Community Occupancy
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Location: <strong>{reportingSpace.name}</strong>. Your update helps fellow Dundee students see current study demand.
            </p>

            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Occupancy level">
              {(['Low', 'Medium', 'Busy'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSelectedLevel(lvl)}
                  aria-checked={selectedLevel === lvl}
                  role="radio"
                  className={`min-h-[44px] rounded-xl text-sm font-semibold border transition ${
                    selectedLevel === lvl
                      ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white border-transparent'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 min-h-[40px]">
              <input
                type="checkbox"
                checked={submitAnon}
                onChange={(e) => setSubmitAnon(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>Submit pseudonymously (&ldquo;Anonymous student&rdquo;)</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReportingSpace(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1D4ED8] text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
