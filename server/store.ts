import fs from 'node:fs';
import path from 'node:path';
import { VERIFIED_CITY_CAMPUS_LOCATIONS } from '../src/data/dundeeLocations';
import type {
  AdminAuditEntry,
  CampusLocation,
  CheckInSession,
  CommunityItem,
  FacilityReport,
  OccupancyLevel,
  QrCodeRecord,
  UserProfile,
} from '../src/types/campus';
import { generateId, hashPassword, signQrToken } from './crypto';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  verificationToken: string | null;
  resetToken: string | null;
  resetTokenExpiresAt: number | null;
}

export interface StoredOccupancyReport {
  id: string;
  locationId: string;
  level: Exclude<OccupancyLevel, 'Unknown'>;
  userId: string | null;
  pseudonym: string;
  createdAt: string;
}

export interface StoreData {
  users: StoredUser[];
  locations: CampusLocation[];
  qrCodes: QrCodeRecord[];
  checkIns: CheckInSession[];
  occupancyReports: StoredOccupancyReport[];
  facilityReports: FacilityReport[];
  communityItems: CommunityItem[];
  auditLogs: AdminAuditEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'campuspulse-store.json');

function buildInitialStore(): StoreData {
  const now = Date.now();
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  const libExp = now + oneYearMs;
  const dalExp = now + oneYearMs;
  const dusaExp = now + oneYearMs;

  const adminId = 'usr_admin_dundee';
  const studentId = 'usr_student_ewan';

  const users: StoredUser[] = [
    {
      id: adminId,
      email: 'admin@campuspulse.test',
      emailVerified: true,
      role: 'admin',
      displayName: 'CampusPulse Admin',
      courseOrSubject: 'CS32005 Mobile App Development',
      studyPreferences: ['Quiet study', 'Accessible access'],
      accessibilityPreferences: '',
      notificationPreferences: {
        campusAnnouncements: true,
        studySpaceAlerts: true,
        reportUpdates: true,
      },
      privacyPreferences: {
        allowGpsNavigation: true,
        anonymousOccupancyReports: false,
      },
      createdAt: new Date(now - 14 * 86400_000).toISOString(),
      passwordHash: hashPassword('AdminDundee2026!'),
      verificationToken: null,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
    {
      id: studentId,
      email: 'student@campuspulse.test',
      emailVerified: true,
      role: 'student',
      displayName: 'Ewan MacLeod',
      courseOrSubject: 'BSc Computing Science',
      studyPreferences: ['Quiet study', 'Power sockets', 'Wi-Fi'],
      accessibilityPreferences: 'Step-free lift access preferred',
      notificationPreferences: {
        campusAnnouncements: true,
        studySpaceAlerts: true,
        reportUpdates: true,
      },
      privacyPreferences: {
        allowGpsNavigation: true,
        anonymousOccupancyReports: true,
      },
      createdAt: new Date(now - 7 * 86400_000).toISOString(),
      passwordHash: hashPassword('StudentDundee2026!'),
      verificationToken: null,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  ];

  const qrCodes: QrCodeRecord[] = [
    {
      id: 'qr_mainlib_01',
      locationId: 'main-library',
      locationName: 'Main Library',
      label: 'Main Library — Floor 2 Quiet Study',
      token: signQrToken('main-library', 'qr_mainlib_01', libExp),
      active: true,
      expiresAt: new Date(libExp).toISOString(),
      createdAt: new Date(now - 5 * 86400_000).toISOString(),
      createdBy: adminId,
    },
    {
      id: 'qr_dalhousie_01',
      locationId: 'dalhousie-building',
      locationName: 'Dalhousie Building',
      label: 'Dalhousie Building — Ground Foyer Study Tables',
      token: signQrToken('dalhousie-building', 'qr_dalhousie_01', dalExp),
      active: true,
      expiresAt: new Date(dalExp).toISOString(),
      createdAt: new Date(now - 5 * 86400_000).toISOString(),
      createdBy: adminId,
    },
    {
      id: 'qr_dusa_01',
      locationId: 'dusa-union',
      locationName: "DUSA – Dundee University Students' Association",
      label: 'DUSA — Student Lounge Collaborative Booths',
      token: signQrToken('dusa-union', 'qr_dusa_01', dusaExp),
      active: true,
      expiresAt: new Date(dusaExp).toISOString(),
      createdAt: new Date(now - 5 * 86400_000).toISOString(),
      createdBy: adminId,
    },
  ];

  const occupancyReports: StoredOccupancyReport[] = [
    {
      id: generateId('occ'),
      locationId: 'main-library',
      level: 'Medium',
      userId: studentId,
      pseudonym: 'CS Student',
      createdAt: new Date(now - 18 * 60_000).toISOString(),
    },
    {
      id: generateId('occ'),
      locationId: 'dusa-union',
      level: 'Busy',
      userId: null,
      pseudonym: 'Anonymous student',
      createdAt: new Date(now - 32 * 60_000).toISOString(),
    },
    {
      id: generateId('occ'),
      locationId: 'dalhousie-building',
      level: 'Low',
      userId: null,
      pseudonym: 'Anonymous student',
      createdAt: new Date(now - 95 * 60_000).toISOString(),
    },
  ];

  const facilityReports: FacilityReport[] = [
    {
      id: generateId('rep'),
      userId: studentId,
      reporterDisplay: 'Ewan MacLeod',
      locationId: 'main-library',
      locationName: 'Main Library',
      category: 'Faulty sockets',
      description: 'Two desk power sockets near the west window on Level 2 have no power output.',
      status: 'Under review',
      adminNotes: 'Logged for verification in CampusPulse study space notes.',
      createdAt: new Date(now - 2 * 86400_000).toISOString(),
      updatedAt: new Date(now - 1 * 86400_000).toISOString(),
    },
  ];

  const communityItems: CommunityItem[] = [
    {
      id: 'comm_ann_01',
      kind: 'announcement',
      title: 'Welcome to CampusPulse Dundee (CS32005 Independent Student Project)',
      body: 'Use Smart Study Space Finder and voluntary QR check-ins to share study room availability across City Campus. All occupancy figures are community-reported estimates, not official University data.',
      locationId: 'main-library',
      locationName: 'Main Library',
      authorName: 'CampusPulse Team',
      authorId: adminId,
      isDemoData: false,
      flaggedCount: 0,
      moderationStatus: 'approved',
      createdAt: new Date(now - 3 * 86400_000).toISOString(),
    },
    {
      id: 'comm_evt_01',
      kind: 'event',
      title: 'DUSA Societies & Study Fair (Demonstration Event)',
      body: 'Sample student union showcase at DUSA Airlie Place featuring academic societies, computing clubs, and peer mentoring booths.',
      locationId: 'dusa-union',
      locationName: "DUSA – Dundee University Students' Association",
      startsAt: new Date(now + 2 * 86400_000).toISOString(),
      authorName: 'Student Community (Demo)',
      authorId: adminId,
      isDemoData: true,
      flaggedCount: 0,
      moderationStatus: 'approved',
      participantsCount: 24,
      createdAt: new Date(now - 2 * 86400_000).toISOString(),
    },
    {
      id: 'comm_grp_01',
      kind: 'study-group',
      title: 'CS32005 Mobile Dev Sprint & Usability Testing Group (Demo)',
      body: 'Informal peer study session near Queen Mother Building / Main Library booths for React Native, TypeScript, and accessibility review.',
      locationId: 'queen-mother-building',
      locationName: 'Queen Mother Building',
      startsAt: new Date(now + 1 * 86400_000).toISOString(),
      authorName: 'Ewan MacLeod',
      authorId: studentId,
      isDemoData: true,
      flaggedCount: 0,
      moderationStatus: 'approved',
      participantsCount: 6,
      createdAt: new Date(now - 1 * 86400_000).toISOString(),
    },
    {
      id: 'comm_rec_01',
      kind: 'recommendation',
      title: 'Tip: Quiet Level 2 booths at Main Library before 10:00 (Demo)',
      body: 'Early morning arrival gives the best choice of window desks with sockets. Remember your University ID card for the Smalls Wynd turnstiles.',
      locationId: 'main-library',
      locationName: 'Main Library',
      authorName: 'Student Contributor (Demo)',
      authorId: studentId,
      isDemoData: true,
      flaggedCount: 0,
      moderationStatus: 'approved',
      createdAt: new Date(now - 12 * 3600_000).toISOString(),
    },
  ];

  const auditLogs: AdminAuditEntry[] = [
    {
      id: generateId('aud'),
      adminId,
      adminEmail: 'admin@campuspulse.test',
      action: 'INITIALIZE_QR_CODES',
      targetType: 'qr_codes',
      targetId: 'system',
      details: 'Generated initial signed CampusPulse QR tokens for Main Library, Dalhousie, and DUSA.',
      createdAt: new Date(now - 5 * 86400_000).toISOString(),
    },
  ];

  return {
    users,
    locations: VERIFIED_CITY_CAMPUS_LOCATIONS,
    qrCodes,
    checkIns: [],
    occupancyReports,
    facilityReports,
    communityItems,
    auditLogs,
  };
}

let cachedStore: StoreData | null = null;

export function getStore(): StoreData {
  if (cachedStore) return cachedStore;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      cachedStore = JSON.parse(raw) as StoreData;
      return cachedStore;
    } catch {
      // Fallback to fresh store if corrupted
    }
  }
  cachedStore = buildInitialStore();
  saveStore(cachedStore);
  return cachedStore;
}

export function saveStore(data: StoreData): void {
  cachedStore = data;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

export function sanitizeUserProfile(u: StoredUser): UserProfile {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerified,
    role: u.role,
    displayName: u.displayName,
    courseOrSubject: u.courseOrSubject,
    studyPreferences: u.studyPreferences,
    accessibilityPreferences: u.accessibilityPreferences,
    avatarUrl: u.avatarUrl,
    notificationPreferences: u.notificationPreferences,
    privacyPreferences: u.privacyPreferences,
    createdAt: u.createdAt,
  };
}
