import type {
  CampusLocation,
  OccupancyLevel,
  ReportCategory,
  StudySpaceSummary,
} from '../types/campus';

export const OCCUPANCY_STALE_MINUTES = 60;

export function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function formatDistanceLabel(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function estimateWalkingMinutes(meters: number): number {
  // Average campus walking speed ~75 meters/min (4.5 km/h)
  return Math.max(1, Math.round(meters / 75));
}

export function isOccupancyStale(
  lastUpdatedAt: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!lastUpdatedAt) return true;
  const updatedMs = Date.parse(lastUpdatedAt);
  if (Number.isNaN(updatedMs)) return true;
  return nowMs - updatedMs > OCCUPANCY_STALE_MINUTES * 60 * 1000;
}

export interface OccupancyReportSignal {
  level: Exclude<OccupancyLevel, 'Unknown'>;
  createdAt: string;
}

export function computeOccupancyFromSignals(
  activeCheckIns: number,
  recentReports: OccupancyReportSignal[],
  nowMs: number = Date.now()
): {
  occupancy: OccupancyLevel;
  lastUpdatedAt: string | null;
  isStale: boolean;
} {
  const sortedReports = [...recentReports].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  );
  const latestReport = sortedReports[0] ?? null;

  // Consider reports within 2 hours for live level, otherwise mark stale / fallback to check-ins
  const freshReports = sortedReports.filter(
    (r) => nowMs - Date.parse(r.createdAt) <= 120 * 60 * 1000
  );

  if (activeCheckIns === 0 && !latestReport) {
    return {
      occupancy: 'Unknown',
      lastUpdatedAt: null,
      isStale: true,
    };
  }

  let occupancy: OccupancyLevel = 'Unknown';
  if (freshReports.length > 0) {
    // Weighted towards most recent report, nudged upward if active check-ins are high
    const scoreMap: Record<Exclude<OccupancyLevel, 'Unknown'>, number> = {
      Low: 1,
      Medium: 2,
      Busy: 3,
    };
    const recentSlice = freshReports.slice(0, 5);
    const avg =
      recentSlice.reduce((sum, r) => sum + scoreMap[r.level], 0) /
      recentSlice.length;
    const adjusted = avg + (activeCheckIns >= 12 ? 0.6 : activeCheckIns >= 5 ? 0.25 : 0);
    if (adjusted < 1.55) occupancy = 'Low';
    else if (adjusted < 2.45) occupancy = 'Medium';
    else occupancy = 'Busy';
  } else if (activeCheckIns > 0) {
    if (activeCheckIns < 4) occupancy = 'Low';
    else if (activeCheckIns < 10) occupancy = 'Medium';
    else occupancy = 'Busy';
  } else if (latestReport) {
    occupancy = latestReport.level;
  }

  const lastUpdatedAt = latestReport ? latestReport.createdAt : new Date(nowMs).toISOString();
  const stale = isOccupancyStale(lastUpdatedAt, nowMs);

  return {
    occupancy,
    lastUpdatedAt,
    isStale: activeCheckIns > 0 ? false : stale,
  };
}

export interface StudySpaceFilters {
  query?: string;
  quietOnly?: boolean;
  groupOnly?: boolean;
  accessibleOnly?: boolean;
  wifiOnly?: boolean;
  socketsOnly?: boolean;
  seatingOnly?: boolean;
}

export function filterStudySpaces(
  spaces: StudySpaceSummary[],
  filters: StudySpaceFilters
): StudySpaceSummary[] {
  const q = (filters.query ?? '').trim().toLowerCase();

  return spaces
    .filter((s) => {
      if (q) {
        const hay = `${s.name} ${s.description} ${s.streetContext} ${s.verifiedFacilities.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.quietOnly && !s.studyFeatures?.quietZone) return false;
      if (filters.groupOnly && !s.studyFeatures?.groupStudy) return false;
      if (filters.accessibleOnly && !(s.accessibilityVerified && s.studyFeatures?.accessibleSeating)) return false;
      if (filters.wifiOnly && !s.studyFeatures?.wifiVerified) return false;
      if (filters.socketsOnly && !s.studyFeatures?.powerSocketsVerified) return false;
      if (filters.seatingOnly && !s.studyFeatures?.seatingInfoVerified) return false;
      return true;
    })
    .sort((a, b) => {
      // Prioritise Main Library first, then verified study spaces
      if (a.id === 'main-library') return -1;
      if (b.id === 'main-library') return 1;
      return a.name.localeCompare(b.name);
    });
}

export function filterLocations(
  locations: CampusLocation[],
  query: string,
  category: string = 'All'
): CampusLocation[] {
  const q = query.trim().toLowerCase();
  return locations.filter((loc) => {
    if (category !== 'All' && loc.category !== category) return false;
    if (!q) return true;
    const hay = `${loc.name} ${loc.shortName} ${loc.streetContext} ${loc.description} ${loc.verifiedFacilities.join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
}

export const VALID_REPORT_CATEGORIES: ReportCategory[] = [
  'Broken equipment',
  'Damaged furniture',
  'Faulty sockets',
  'Cleanliness concerns',
  'Accessibility obstacles',
  'Incorrect facility information',
];

export function validateFacilityReportInput(input: {
  locationId: string;
  category: string;
  description: string;
  photoDataUrl?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.locationId || input.locationId.trim().length < 2) {
    return { ok: false, error: 'Please select a valid campus location.' };
  }
  if (!VALID_REPORT_CATEGORIES.includes(input.category as ReportCategory)) {
    return { ok: false, error: 'Please select a valid report category.' };
  }
  const desc = input.description.trim();
  if (desc.length < 10) {
    return { ok: false, error: 'Description must be at least 10 characters.' };
  }
  if (desc.length > 1000) {
    return { ok: false, error: 'Description must not exceed 1000 characters.' };
  }
  if (input.photoDataUrl) {
    if (!input.photoDataUrl.startsWith('data:image/')) {
      return { ok: false, error: 'Photo attachment must be a valid image file.' };
    }
    if (input.photoDataUrl.length > 600_000) {
      return { ok: false, error: 'Photo attachment is too large (max ~450 KB).' };
    }
  }
  return { ok: true };
}

export function validateRegistrationInput(input: {
  email: string;
  password: string;
  displayName: string;
}): { ok: true } | { ok: false; error: string } {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  if (input.displayName.trim().length < 2 || input.displayName.trim().length > 60) {
    return { ok: false, error: 'Display name must be between 2 and 60 characters.' };
  }
  if (input.password.length < 8 || input.password.length > 128) {
    return { ok: false, error: 'Password must be between 8 and 128 characters.' };
  }
  return { ok: true };
}

export function parseQrCodeTokenString(raw: string): {
  validFormat: boolean;
  locationId?: string;
  codeId?: string;
  expiresAtMs?: number;
  signature?: string;
} {
  const trimmed = raw.trim();
  // Format: CP-DUNDEE:<locationId>:<codeId>:<expiresAtMs>:<hmacHex>
  const parts = trimmed.split(':');
  if (parts.length !== 5 || parts[0] !== 'CP-DUNDEE') {
    return { validFormat: false };
  }
  const [, locationId, codeId, expiresStr, signature] = parts;
  if (!/^[a-z0-9-]+$/.test(locationId) || !/^[a-zA-Z0-9_-]+$/.test(codeId)) {
    return { validFormat: false };
  }
  const expiresAtMs = Number(expiresStr);
  if (!Number.isFinite(expiresAtMs) || !/^[a-f0-9]{16,64}$/i.test(signature)) {
    return { validFormat: false };
  }
  return {
    validFormat: true,
    locationId,
    codeId,
    expiresAtMs,
    signature,
  };
}

export function decodeWmoWeatherCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Coastal mist / fog';
  if (code >= 51 && code <= 57) return 'Light drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow / sleet';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Variable Scottish weather';
}
