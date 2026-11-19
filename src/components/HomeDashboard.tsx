import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Calendar,
  CloudSun,
  Compass,
  ExternalLink,
  QrCode,
  Search,
  ShieldAlert,
  Sparkles,
  Wind,
} from 'lucide-react';
import {
  DUNDEE_CITY_CAMPUS_CENTER,
  OFFICIAL_CAMPUS_REFERENCES,
} from '../data/dundeeLocations';
import { useApp } from '../context/AppContext';
import {
  calculateDistanceMeters,
  filterLocations,
  formatDistanceLabel,
} from '../utils/campusLogic';
import { DepthCard } from './DepthCard';

export const HomeDashboard: React.FC = () => {
  const {
    user,
    locations,
    studySpaces,
    weather,
    communityItems,
    favouriteIds,
    toggleFavourite,
    activeCheckIn,
    userCoords,
    setActiveTab,
    openLocationOnMap,
    openReportForLocation,
    dataLoading,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [dundeeTime, setDundeeTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setDundeeTime(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dundeeTime),
    [dundeeTime]
  );

  const formattedTime = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hour: '2-digit',
        minute: '2-digit',
      }).format(dundeeTime),
    [dundeeTime]
  );

  const origin = userCoords ?? DUNDEE_CITY_CAMPUS_CENTER;

  const filteredBuildings = useMemo(() => {
    const list = filterLocations(locations, searchQuery);
    return [...list].sort(
      (a, b) =>
        calculateDistanceMeters(origin.lat, origin.lng, a.lat, a.lng) -
        calculateDistanceMeters(origin.lat, origin.lng, b.lat, b.lng)
    );
  }, [locations, origin.lat, origin.lng, searchQuery]);

  const favouriteLocations = useMemo(
    () => locations.filter((l) => favouriteIds.includes(l.id)),
    [locations, favouriteIds]
  );

  const recommendedStudy = useMemo(() => {
    return [...studySpaces]
      .sort((a, b) => {
        if (a.id === 'main-library') return -1;
        if (b.id === 'main-library') return 1;
        return 0;
      })
      .slice(0, 3);
  }, [studySpaces]);

  const announcements = useMemo(
    () => communityItems.filter((c) => c.kind === 'announcement').slice(0, 2),
    [communityItems]
  );

  const upcomingEvents = useMemo(
    () => communityItems.filter((c) => c.kind === 'event' || c.kind === 'study-group').slice(0, 3),
    [communityItems]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Hero & Dundee Overview Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <DepthCard
          maxTilt={3}
          className="lg:col-span-8 rounded-3xl overflow-hidden bg-[#0B1B3B] text-white min-h-[280px] flex flex-col justify-end shadow-lg"
        >
          <img
            src="/src/assets/images/city_campus_hero_1795118448130.jpg"
            alt="University of Dundee City Campus architectural view"
            className="absolute inset-0 w-full h-full object-cover opacity-55"
            referrerPolicy="no-referrer"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#09111F] via-[#0B1B3B]/75 to-[#0B1B3B]/30"
          />
          <div className="relative cp-depth-layer p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sky-200 font-medium">
              <span>University of Dundee · City Campus</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {formattedDate}, {formattedTime} (UK)
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-balance max-w-2xl">
              {user
                ? `Welcome back, ${user.displayName}`
                : 'Your Campus. Your Community. Your University.'}
            </h1>

            <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
              Independent student companion for City Campus buildings, verified study facilities,
              voluntary QR check-ins, and accessible campus navigation.
            </p>

            {/* Quick Search + Primary QR Scan */}
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="home-campus-search" className="sr-only">
                  Search Dundee City Campus locations
                </label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="home-campus-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Main Library, Dalhousie, DUSA, Queen Mother..."
                  className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 placeholder-slate-500 text-sm focus:outline-2 focus:outline-sky-400"
                />
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('scan')}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-sky-400 text-[#09111F] font-semibold text-sm whitespace-nowrap shrink-0 transition"
              >
                <QrCode className="w-4 h-4" />
                <span>{activeCheckIn ? 'Manage Check-In' : 'Scan Study QR'}</span>
              </button>
            </div>
          </div>
        </DepthCard>

        {/* Weather & Active Status Panel */}
        <aside className="lg:col-span-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-6 cp-card-3d">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Dundee Weather
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {weather?.source ?? 'Loading'}
              </span>
            </div>

            {weather ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-display text-4xl font-bold text-[#0B1B3B] dark:text-white tabular-nums">
                    {weather.temperatureC}°C
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    {weather.conditionLabel}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>Feels like {weather.apparentTemperatureC}°C</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Wind className="w-3.5 h-3.5" />
                      {weather.windSpeedKmh} km/h
                    </span>
                  </div>
                </div>
                <CloudSun className="w-12 h-12 text-sky-600 dark:text-sky-400 shrink-0" />
              </div>
            ) : (
              <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Project Disclosure</span>
              <span>CS32005 Independent App</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              CampusPulse Dundee is an independent student project and is not an official
              University of Dundee service.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('study')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Find Study Space
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Open Campus Map
              </button>
            </div>
          </div>
        </aside>
      </section>

      {/* Active Check-In Banner if checked in */}
      {activeCheckIn && (
        <section
          aria-label="Active study check-in"
          className="rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <p className="text-xs font-medium text-sky-800 dark:text-sky-300">
              Active Voluntary Check-In Session
            </p>
            <p className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">
              Checked in at {activeCheckIn.locationName}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
              Started at {new Date(activeCheckIn.checkedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-sm font-medium whitespace-nowrap shrink-0"
          >
            Check Out / View Session
          </button>
        </section>
      )}

      {/* Search Results (when user types in home search) or Recommended Study Spaces */}
      {searchQuery.trim() ? (
        <section aria-label="Campus search results" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Matching City Campus Locations ({filteredBuildings.length})
            </h2>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-sm text-[#1D4ED8] dark:text-sky-400 hover:underline"
            >
              Clear search
            </button>
          </div>
          {filteredBuildings.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                No verified City Campus locations matched &ldquo;{searchQuery}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBuildings.map((loc) => {
                const dist = calculateDistanceMeters(origin.lat, origin.lng, loc.lat, loc.lng);
                const isFav = favouriteIds.includes(loc.id);
                return (
                  <article
                    key={loc.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                          {loc.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => toggleFavourite(loc.id)}
                          aria-label={isFav ? `Remove ${loc.name} from favourites` : `Save ${loc.name} to favourites`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-[#1D4ED8] dark:hover:text-sky-400"
                        >
                          <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current text-[#1D4ED8] dark:text-sky-400' : ''}`} />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {loc.streetContext} · {loc.accessLevel} ·{' '}
                        <span className="tabular-nums">{formatDistanceLabel(dist)}</span>
                      </p>
                      <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                        {loc.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => openLocationOnMap(loc.id)}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#0B1B3B] dark:bg-sky-600 text-white text-xs font-medium"
                      >
                        View on Map
                      </button>
                      <button
                        type="button"
                        onClick={() => openReportForLocation(loc.id)}
                        className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Report Issue
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Recommended Study Spaces */}
          <section aria-label="Recommended study locations" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  City Campus Study Recommendations
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Occupancy estimates reflect voluntary CampusPulse check-ins & student reports, not official University systems.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('study')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1D4ED8] dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
              >
                All study spaces
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {dataLoading && recommendedStudy.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-56 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {recommendedStudy.map((space) => {
                  const dist = calculateDistanceMeters(
                    origin.lat,
                    origin.lng,
                    space.lat,
                    space.lng
                  );
                  return (
                    <article
                      key={space.id}
                      className="group rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between cp-card-3d"
                    >
                      {space.imageUrl ? (
                        <div className="h-36 overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <img
                            src={space.imageUrl}
                            alt={space.name}
                            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="h-36 bg-gradient-to-br from-[#0B1B3B] to-[#1D4ED8] p-5 flex flex-col justify-end text-white">
                          <span className="text-[11px] font-medium text-sky-200">
                            {space.category}
                          </span>
                          <span className="font-display text-base font-semibold truncate">
                            {space.shortName}
                          </span>
                        </div>
                      )}
                      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {space.streetContext} ·{' '}
                            <span className="tabular-nums">{formatDistanceLabel(dist)}</span>
                          </div>
                          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mt-1">
                            {space.name}
                          </h3>
                          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                            Community occupancy:{' '}
                            <strong className="text-slate-900 dark:text-white">
                              {space.occupancy}
                            </strong>
                            {space.isStale ? ' (outdated / unverified)' : ''}
                          </p>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                            {space.studyFeatures?.seatingSummary || space.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => openLocationOnMap(space.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] dark:text-sky-400 hover:underline min-h-[40px]"
                          >
                            <Compass className="w-4 h-4" />
                            Directions
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('study')}
                            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                          >
                            Update Occupancy
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Favourites, Announcements & Community Grid */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Favourite Destinations & Nearby Buildings */}
            <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Favourite & Nearby Destinations
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('map')}
                  className="text-xs font-medium text-[#1D4ED8] dark:text-sky-400 hover:underline"
                >
                  All 20 buildings
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(favouriteLocations.length > 0 ? favouriteLocations : filteredBuildings.slice(0, 4)).map(
                  (loc) => {
                    const dist = calculateDistanceMeters(origin.lat, origin.lng, loc.lat, loc.lng);
                    return (
                      <div key={loc.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {loc.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {loc.streetContext} · {loc.accessLevel} ·{' '}
                            <span className="tabular-nums">{formatDistanceLabel(dist)}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openLocationOnMap(loc.id)}
                          className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
                        >
                          Locate
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Campus Announcements & Upcoming Events */}
            <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Campus Updates & Activities
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('community')}
                  className="text-xs font-medium text-[#1D4ED8] dark:text-sky-400 hover:underline"
                >
                  Open Community
                </button>
              </div>

              <div className="space-y-3">
                {[...announcements, ...upcomingEvents].slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span className="capitalize">{item.kind.replace('-', ' ')}</span>
                      {item.isDemoData && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Demonstration sample</span>
                        </>
                      )}
                      {item.locationName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{item.locationName}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Future Campus Roadmap & Official University References */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Sparkles className="w-4 h-4 text-[#1D4ED8] dark:text-sky-400" />
                <h2 className="font-display text-base font-bold">
                  Campus Coverage & Roadmap
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Primary Target:</strong> University of Dundee City Campus (20 verified locations).
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Future Expansion:</strong> Ninewells Campus (School of Medicine) and
                Kirkcaldy Campus (School of Health Sciences) are scheduled for Phase 2 expansion.
              </p>
              <button
                type="button"
                onClick={() => openReportForLocation('main-library')}
                className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <ShieldAlert className="w-4 h-4" />
                Report a Facility Issue to CampusPulse Admins
              </button>
            </div>

            <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Official University of Dundee References
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Always verify official building opening times, AccessAble audits, and campus maps directly with the University:
              </p>
              <ul className="space-y-2">
                {OFFICIAL_CAMPUS_REFERENCES.map((ref) => (
                  <li key={ref.url}>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] dark:text-sky-400 hover:underline"
                    >
                      <span>{ref.label}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
