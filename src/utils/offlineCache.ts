import type {
  CampusLocation,
  CommunityItem,
  StudySpaceSummary,
  WeatherSummary,
} from '../types/campus';

const PREFIX = 'campuspulse_dundee_v1:';

export function saveOfflineCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(
      `${PREFIX}${key}`,
      JSON.stringify({ savedAt: new Date().toISOString(), value })
    );
  } catch {
    // Ignore storage quota issues
  }
}

export function loadOfflineCache<T>(key: string): { savedAt: string; value: T } | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as { savedAt: string; value: T };
  } catch {
    return null;
  }
}

export interface OfflinePendingAction {
  id: string;
  endpoint: string;
  method: 'POST';
  body: Record<string, unknown>;
  createdAt: string;
  label: string;
}

export function getPendingOfflineActions(): OfflinePendingAction[] {
  return loadOfflineCache<OfflinePendingAction[]>('pending_actions')?.value ?? [];
}

export function queueOfflineAction(action: Omit<OfflinePendingAction, 'id' | 'createdAt'>): void {
  const current = getPendingOfflineActions();
  current.push({
    ...action,
    id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  });
  saveOfflineCache('pending_actions', current);
}

export async function flushPendingOfflineActions(): Promise<number> {
  const queue = getPendingOfflineActions();
  if (queue.length === 0) return 0;

  const remaining: OfflinePendingAction[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.endpoint, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item.body),
      });
      if (res.ok || res.status < 500) {
        synced += 1;
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  saveOfflineCache('pending_actions', remaining);
  return synced;
}

export function cacheCampusSnapshot(data: {
  locations?: CampusLocation[];
  studySpaces?: StudySpaceSummary[];
  weather?: WeatherSummary;
  community?: CommunityItem[];
}) {
  if (data.locations) saveOfflineCache('locations', data.locations);
  if (data.studySpaces) saveOfflineCache('study_spaces', data.studySpaces);
  if (data.weather) saveOfflineCache('weather', data.weather);
  if (data.community) saveOfflineCache('community', data.community);
}
