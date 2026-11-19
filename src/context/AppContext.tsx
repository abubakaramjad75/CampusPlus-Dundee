import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { VERIFIED_CITY_CAMPUS_LOCATIONS } from '../data/dundeeLocations';
import {
  auth,
  signInWithGoogleFirebase,
  signOutFirebase,
  testFirestoreConnection,
} from '../firebase/client';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type {
  ActiveTab,
  CampusLocation,
  CheckInSession,
  CommunityItem,
  FacilityReport,
  StudySpaceSummary,
  UserProfile,
  WeatherSummary,
} from '../types/campus';
import {
  cacheCampusSnapshot,
  flushPendingOfflineActions,
  getPendingOfflineActions,
  loadOfflineCache,
  saveOfflineCache,
} from '../utils/offlineCache';

export type TextScale = 'normal' | 'large' | 'xlarge';

interface ToastMessage {
  id: string;
  tone: 'info' | 'success' | 'error';
  text: string;
}

interface AppContextValue {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  focusedMapLocationId: string | null;
  openLocationOnMap: (locationId: string) => void;
  preselectedReportLocationId: string | null;
  openReportForLocation: (locationId: string) => void;

  user: UserProfile | null;
  firebaseUid: string | null;
  authLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  refreshSession: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logoutAll: () => Promise<void>;

  theme: 'light' | 'dark';
  toggleTheme: () => void;
  textScale: TextScale;
  setTextScale: (scale: TextScale) => void;

  isOnline: boolean;
  pendingOfflineCount: number;
  firestoreConnected: boolean | null;

  locations: CampusLocation[];
  studySpaces: StudySpaceSummary[];
  weather: WeatherSummary | null;
  communityItems: CommunityItem[];
  activeCheckIn: CheckInSession | null;
  checkInHistory: CheckInSession[];
  myReports: FacilityReport[];
  dataLoading: boolean;

  favouriteIds: string[];
  toggleFavourite: (locationId: string) => void;
  recentIds: string[];
  recordRecentLocation: (locationId: string) => void;

  userCoords: { lat: number; lng: number } | null;
  gpsStatus: 'idle' | 'locating' | 'granted' | 'denied';
  requestGpsLocation: () => void;

  refreshCampusData: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  notify: (text: string, tone?: 'info' | 'success' | 'error') => void;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [focusedMapLocationId, setFocusedMapLocationId] = useState<string | null>(null);
  const [preselectedReportLocationId, setPreselectedReportLocationId] = useState<string | null>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('cp_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [textScale, setTextScaleState] = useState<TextScale>(() => {
    const saved = localStorage.getItem('cp_text_scale');
    return saved === 'large' || saved === 'xlarge' ? saved : 'normal';
  });

  const [locations, setLocations] = useState<CampusLocation[]>(() => {
    return loadOfflineCache<CampusLocation[]>('locations')?.value ?? VERIFIED_CITY_CAMPUS_LOCATIONS;
  });
  const [studySpaces, setStudySpaces] = useState<StudySpaceSummary[]>(() => {
    return loadOfflineCache<StudySpaceSummary[]>('study_spaces')?.value ?? [];
  });
  const [weather, setWeather] = useState<WeatherSummary | null>(() => {
    return loadOfflineCache<WeatherSummary>('weather')?.value ?? null;
  });
  const [communityItems, setCommunityItems] = useState<CommunityItem[]>(() => {
    return loadOfflineCache<CommunityItem[]>('community')?.value ?? [];
  });
  const [activeCheckIn, setActiveCheckIn] = useState<CheckInSession | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<CheckInSession[]>([]);
  const [myReports, setMyReports] = useState<FacilityReport[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(
    () => getPendingOfflineActions().length
  );
  const [firestoreConnected, setFirestoreConnected] = useState<boolean | null>(null);

  const [favouriteIds, setFavouriteIds] = useState<string[]>(() => {
    return loadOfflineCache<string[]>('favourites')?.value ?? ['main-library', 'dusa-union'];
  });
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    return loadOfflineCache<string[]>('recents')?.value ?? ['main-library'];
  });

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'granted' | 'denied'>('idle');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = `tst_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    setToasts([{ id, tone, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Sync theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('cp_theme', theme);
  }, [theme]);

  // Sync text scale
  useEffect(() => {
    const scaleMap: Record<TextScale, string> = {
      normal: '1',
      large: '1.12',
      xlarge: '1.22',
    };
    document.documentElement.style.setProperty('--cp-font-scale', scaleMap[textScale]);
    localStorage.setItem('cp_text_scale', textScale);
  }, [textScale]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }, []);

  const setTextScale = useCallback((scale: TextScale) => {
    setTextScaleState(scale);
  }, []);

  const toggleFavourite = useCallback(
    (locationId: string) => {
      setFavouriteIds((prev) => {
        const next = prev.includes(locationId)
          ? prev.filter((id) => id !== locationId)
          : [...prev, locationId];
        saveOfflineCache('favourites', next);
        return next;
      });
    },
    []
  );

  const recordRecentLocation = useCallback((locationId: string) => {
    setRecentIds((prev) => {
      const next = [locationId, ...prev.filter((id) => id !== locationId)].slice(0, 6);
      saveOfflineCache('recents', next);
      return next;
    });
  }, []);

  const refreshCampusData = useCallback(async () => {
    try {
      const [locRes, studyRes, weatherRes, commRes] = await Promise.all([
        fetch('/api/locations', { credentials: 'include' }),
        fetch('/api/study-spaces', { credentials: 'include' }),
        fetch('/api/weather', { credentials: 'include' }),
        fetch('/api/community', { credentials: 'include' }),
      ]);

      const nextLocs = locRes.ok ? ((await locRes.json()).locations as CampusLocation[]) : undefined;
      const nextStudy = studyRes.ok
        ? ((await studyRes.json()).studySpaces as StudySpaceSummary[])
        : undefined;
      const nextWeather = weatherRes.ok ? ((await weatherRes.json()) as WeatherSummary) : undefined;
      const nextComm = commRes.ok ? ((await commRes.json()).items as CommunityItem[]) : undefined;

      if (nextLocs) setLocations(nextLocs);
      if (nextStudy) setStudySpaces(nextStudy);
      if (nextWeather) setWeather(nextWeather);
      if (nextComm) setCommunityItems(nextComm);

      cacheCampusSnapshot({
        locations: nextLocs,
        studySpaces: nextStudy,
        weather: nextWeather,
        community: nextComm,
      });
    } catch {
      // Retain offline cached values
    } finally {
      setDataLoading(false);
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    try {
      const [qrRes, repRes] = await Promise.all([
        fetch('/api/qr/history', { credentials: 'include' }),
        fetch('/api/reports', { credentials: 'include' }),
      ]);
      if (qrRes.ok) {
        const qrJson = await qrRes.json();
        setActiveCheckIn(qrJson.activeSession ?? null);
        setCheckInHistory(qrJson.history ?? []);
      }
      if (repRes.ok) {
        const repJson = await repRes.json();
        setMyReports(repJson.reports ?? []);
      }
    } catch {
      // Offline fallback
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      }
    } catch {
      // Offline
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Boot: test Firestore connection, auth state, and campus data
  useEffect(() => {
    testFirestoreConnection().then(setFirestoreConnected);
    refreshSession();
    refreshCampusData();

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUid(fbUser?.uid ?? null);
      if (fbUser && !user) {
        setUser((prev) =>
          prev
            ? prev
            : {
                id: fbUser.uid,
                email: fbUser.email || '',
                emailVerified: fbUser.emailVerified,
                role: fbUser.email === 'arhamrajpoot2122@gmail.com' ? 'admin' : 'student',
                displayName: fbUser.displayName || 'Dundee Student',
                courseOrSubject: '',
                studyPreferences: ['Quiet study'],
                accessibilityPreferences: '',
                avatarUrl: fbUser.photoURL || undefined,
                notificationPreferences: {
                  campusAnnouncements: true,
                  studySpaceAlerts: true,
                  reportUpdates: true,
                },
                privacyPreferences: {
                  allowGpsNavigation: true,
                  anonymousOccupancyReports: false,
                },
                createdAt: new Date().toISOString(),
              }
        );
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      refreshUserData();
    } else {
      setActiveCheckIn(null);
      setCheckInHistory([]);
      setMyReports([]);
    }
  }, [user, refreshUserData]);

  // Flush offline queued actions when back online
  useEffect(() => {
    if (isOnline) {
      flushPendingOfflineActions().then((synced) => {
        setPendingOfflineCount(getPendingOfflineActions().length);
        if (synced > 0) {
          notify(`Synced ${synced} offline update${synced > 1 ? 's' : ''}.`, 'success');
          refreshCampusData();
          refreshUserData();
        }
      });
    }
  }, [isOnline, notify, refreshCampusData, refreshUserData]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const fbUser = await signInWithGoogleFirebase();
      setFirebaseUid(fbUser.uid);
      notify(`Signed in with Google as ${fbUser.displayName || fbUser.email}`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Google Sign-In failed', 'error');
    }
  }, [notify]);

  const logoutAll = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    if (auth.currentUser) {
      await signOutFirebase().catch(() => undefined);
    }
    setUser(null);
    setFirebaseUid(null);
    notify('Signed out of CampusPulse Dundee.', 'info');
  }, [notify]);

  const openLocationOnMap = useCallback(
    (locationId: string) => {
      setFocusedMapLocationId(locationId);
      recordRecentLocation(locationId);
      setActiveTab('map');
    },
    [recordRecentLocation]
  );

  const openReportForLocation = useCallback((locationId: string) => {
    setPreselectedReportLocationId(locationId);
    setActiveTab('community');
  }, []);

  const requestGpsLocation = useCallback(() => {
    if (user && !user.privacyPreferences.allowGpsNavigation) {
      notify('GPS navigation is disabled in your Account Privacy settings.', 'info');
      setGpsStatus('denied');
      return;
    }
    if (!('geolocation' in navigator)) {
      setGpsStatus('denied');
      notify('Geolocation is unavailable on this browser. Use manual starting building.', 'info');
      return;
    }
    setGpsStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('granted');
        notify('Current GPS coordinates updated.', 'success');
      },
      () => {
        setGpsStatus('denied');
        notify('GPS permission declined or unavailable. Using manual campus selector.', 'info');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [notify, user]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        focusedMapLocationId,
        openLocationOnMap,
        preselectedReportLocationId,
        openReportForLocation,
        user,
        firebaseUid,
        authLoading,
        setUser,
        refreshSession,
        signInWithGoogle,
        logoutAll,
        theme,
        toggleTheme,
        textScale,
        setTextScale,
        isOnline,
        pendingOfflineCount,
        firestoreConnected,
        locations,
        studySpaces,
        weather,
        communityItems,
        activeCheckIn,
        checkInHistory,
        myReports,
        dataLoading,
        favouriteIds,
        toggleFavourite,
        recentIds,
        recordRecentLocation,
        userCoords,
        gpsStatus,
        requestGpsLocation,
        refreshCampusData,
        refreshUserData,
        notify,
        toasts,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
