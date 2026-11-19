import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Bookmark,
  ExternalLink,
  LocateFixed,
  Navigation,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { DUNDEE_CITY_CAMPUS_CENTER } from '../data/dundeeLocations';
import { useApp } from '../context/AppContext';
import type { CampusLocation } from '../types/campus';
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
  filterLocations,
  formatDistanceLabel,
} from '../utils/campusLogic';

export const CampusMapView: React.FC = () => {
  const {
    locations,
    focusedMapLocationId,
    favouriteIds,
    toggleFavourite,
    userCoords,
    gpsStatus,
    requestGpsLocation,
    openReportForLocation,
  } = useApp();

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [manualOriginId, setManualOriginId] = useState('tower-building');
  const [useGpsOrigin, setUseGpsOrigin] = useState(false);
  const [selectedLoc, setSelectedLoc] = useState<CampusLocation>(
    () =>
      locations.find((l) => l.id === focusedMapLocationId) ||
      locations.find((l) => l.id === 'main-library') ||
      locations[0]
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (focusedMapLocationId) {
      const found = locations.find((l) => l.id === focusedMapLocationId);
      if (found) setSelectedLoc(found);
    }
  }, [focusedMapLocationId, locations]);

  useEffect(() => {
    if (gpsStatus === 'granted' && userCoords) {
      setUseGpsOrigin(true);
    }
  }, [gpsStatus, userCoords]);

  const originPoint = useMemo(() => {
    if (useGpsOrigin && userCoords) {
      return {
        label: 'Your current GPS location',
        lat: userCoords.lat,
        lng: userCoords.lng,
      };
    }
    const manualLoc = locations.find((l) => l.id === manualOriginId) || locations[0];
    return {
      label: manualLoc?.name || 'Tower Building',
      lat: manualLoc?.lat ?? DUNDEE_CITY_CAMPUS_CENTER.lat,
      lng: manualLoc?.lng ?? DUNDEE_CITY_CAMPUS_CENTER.lng,
    };
  }, [useGpsOrigin, userCoords, locations, manualOriginId]);

  const filteredLocations = useMemo(
    () => filterLocations(locations, query, categoryFilter),
    [locations, query, categoryFilter]
  );

  // Initialize Leaflet OpenStreetMap once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [DUNDEE_CITY_CAMPUS_CENTER.lat, DUNDEE_CITY_CAMPUS_CENTER.lng],
      zoom: 17,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render markers & walking route line
  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !markersLayer || !routeLayer) return;

    markersLayer.clearLayers();
    routeLayer.clearLayers();

    filteredLocations.forEach((loc) => {
      const isSelected = loc.id === selectedLoc?.id;
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: isSelected ? 10 : 7,
        color: '#0B1B3B',
        weight: isSelected ? 3 : 2,
        fillColor: isSelected ? '#0EA5E9' : '#1D4ED8',
        fillOpacity: 0.9,
      });

      marker.bindTooltip(loc.shortName, { direction: 'top', offset: [0, -8] });
      marker.on('click', () => setSelectedLoc(loc));
      marker.addTo(markersLayer);
    });

    // Origin marker
    L.circleMarker([originPoint.lat, originPoint.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      fillColor: '#10B981',
      fillOpacity: 1,
    })
      .bindTooltip(`Start: ${originPoint.label}`)
      .addTo(routeLayer);

    // Walking line to selected destination
    if (selectedLoc) {
      L.polyline(
        [
          [originPoint.lat, originPoint.lng],
          [selectedLoc.lat, selectedLoc.lng],
        ],
        {
          color: '#0EA5E9',
          weight: 3,
          dashArray: '6, 6',
        }
      ).addTo(routeLayer);

      map.panTo([selectedLoc.lat, selectedLoc.lng], { animate: true });
    }
  }, [filteredLocations, selectedLoc, originPoint]);

  const distanceMeters = selectedLoc
    ? calculateDistanceMeters(originPoint.lat, originPoint.lng, selectedLoc.lat, selectedLoc.lng)
    : 0;
  const walkMinutes = estimateWalkingMinutes(distanceMeters);

  const categories = [
    'All',
    'Library & Study',
    'Academic',
    'Student Life',
    'Administration & Venues',
    'Campus Grounds',
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            City Campus Interactive Map
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Powered by OpenStreetMap. Walking lines show straight-line campus estimates between
            verified buildings — check the official University Campus Map for detailed pathways.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={requestGpsLocation}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <LocateFixed className="w-4 h-4" />
            {gpsStatus === 'locating'
              ? 'Locating...'
              : gpsStatus === 'granted'
                ? 'Refresh GPS'
                : 'Use My GPS'}
          </button>

          <label className="sr-only" htmlFor="manual-origin-select">
            Manual starting campus building
          </label>
          <select
            id="manual-origin-select"
            value={useGpsOrigin ? '__gps__' : manualOriginId}
            onChange={(e) => {
              if (e.target.value === '__gps__') {
                setUseGpsOrigin(true);
              } else {
                setUseGpsOrigin(false);
                setManualOriginId(e.target.value);
              }
            }}
            className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100"
          >
            {userCoords && <option value="__gps__">Start: Current GPS</option>}
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                Start: {loc.shortName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search & Category Tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <label htmlFor="map-search" className="sr-only">
            Search campus map buildings
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="map-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all 20 City Campus buildings..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition ${
                categoryFilter === cat
                  ? 'bg-[#0B1B3B] dark:bg-sky-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Map + Selected Location Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <div
            ref={mapContainerRef}
            data-testid="campus-osm-map"
            aria-label="OpenStreetMap of University of Dundee City Campus"
            className="w-full h-[380px] sm:h-[460px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800"
          />

          {/* Scrollable Building Index */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white mb-3">
              Verified City Campus Directory ({filteredLocations.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredLocations.map((loc) => {
                const isSelected = loc.id === selectedLoc?.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedLoc(loc)}
                    className={`min-h-[44px] p-3 rounded-xl text-left transition border ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {loc.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {loc.streetContext} · {loc.accessLevel}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Destination Card */}
        {selectedLoc && (
          <aside className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 cp-card-3d">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedLoc.category} · {selectedLoc.postcode}
                </p>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedLoc.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => toggleFavourite(selectedLoc.id)}
                aria-label="Toggle favourite building"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Bookmark
                  className={`w-5 h-5 ${
                    favouriteIds.includes(selectedLoc.id)
                      ? 'fill-current text-[#1D4ED8] dark:text-sky-400'
                      : 'text-slate-500'
                  }`}
                />
              </button>
            </div>

            {/* Walking Distance Summary */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Navigation className="w-5 h-5 text-[#1D4ED8] dark:text-sky-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    From {originPoint.label}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                    {formatDistanceLabel(distanceMeters)} · ~{walkMinutes} min walk
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {selectedLoc.description}
            </p>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p>
                <strong>Access Level:</strong> {selectedLoc.accessLevel} — {selectedLoc.accessNote}
              </p>
              <p>
                <strong>Street Context:</strong> {selectedLoc.streetContext}
              </p>
              <p>
                <strong>Verified Facilities:</strong> {selectedLoc.verifiedFacilities.join(' · ')}
              </p>
              <p>
                <strong>Accessibility:</strong> {selectedLoc.accessibilityInfo}
              </p>
              <p>
                <strong>Hours:</strong> {selectedLoc.openingHoursNote}
              </p>
              {selectedLoc.coordinatesApproximate && (
                <p className="text-amber-700 dark:text-amber-400">
                  Note: Map pin coordinates are approximate within City Campus; confirm exact
                  entrance on the official University Campus Map.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <a
                href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${originPoint.lat}%2C${originPoint.lng}%3B${selectedLoc.lat}%2C${selectedLoc.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-[#0B1B3B] dark:bg-sky-600 text-white text-xs font-semibold"
              >
                Open OSM Walking Route
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={selectedLoc.officialReferenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
              >
                University Page
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => openReportForLocation(selectedLoc.id)}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Report Facility Issue
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
