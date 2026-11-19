export type AccessLevel =
  | 'Public & Student Access'
  | 'Student & Staff Card Access'
  | 'Restricted / Research Access'
  | 'Event / Controlled Access';

export type OccupancyLevel = 'Low' | 'Medium' | 'Busy' | 'Unknown';

export type BuildingCategory =
  | 'Academic'
  | 'Library & Study'
  | 'Student Life'
  | 'Administration & Venues'
  | 'Campus Grounds';

export interface CampusLocation {
  id: string;
  name: string;
  shortName: string;
  campus: 'City Campus';
  streetContext: string;
  postcode: string;
  category: BuildingCategory;
  accessLevel: AccessLevel;
  accessNote: string;
  description: string;
  lat: number;
  lng: number;
  coordinatesApproximate: boolean;
  verifiedFacilities: string[];
  accessibilityInfo: string;
  accessibilityVerified: boolean;
  openingHoursNote: string;
  officialReferenceUrl: string;
  isStudySpace: boolean;
  studyFeatures?: {
    quietZone: boolean;
    groupStudy: boolean;
    accessibleSeating: boolean;
    wifiVerified: boolean;
    powerSocketsVerified: boolean;
    seatingInfoVerified: boolean;
    seatingSummary: string;
  };
  imageUrl?: string;
}

export interface StudySpaceSummary extends CampusLocation {
  occupancy: OccupancyLevel;
  occupancySource: 'CampusPulse check-ins & community reports' | 'No recent reports';
  activeCheckIns: number;
  lastUpdatedAt: string | null;
  isStale: boolean;
  recentReportsCount: number;
}

export interface WeatherSummary {
  temperatureC: number;
  apparentTemperatureC: number;
  windSpeedKmh: number;
  weatherCode: number;
  conditionLabel: string;
  fetchedAt: string;
  source: 'Open-Meteo Live' | 'Cached Fallback';
}

export interface UserProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  role: 'student' | 'admin';
  displayName: string;
  courseOrSubject: string;
  studyPreferences: string[];
  accessibilityPreferences: string;
  avatarUrl?: string;
  notificationPreferences: {
    campusAnnouncements: boolean;
    studySpaceAlerts: boolean;
    reportUpdates: boolean;
  };
  privacyPreferences: {
    allowGpsNavigation: boolean;
    anonymousOccupancyReports: boolean;
  };
  createdAt: string;
}

export interface CheckInSession {
  id: string;
  userId: string;
  locationId: string;
  locationName: string;
  qrCodeId: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  status: 'active' | 'completed';
}

export interface QrCodeRecord {
  id: string;
  locationId: string;
  locationName: string;
  label: string;
  token: string;
  active: boolean;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
}

export type ReportCategory =
  | 'Broken equipment'
  | 'Damaged furniture'
  | 'Faulty sockets'
  | 'Cleanliness concerns'
  | 'Accessibility obstacles'
  | 'Incorrect facility information';

export type ReportStatus = 'Submitted' | 'Under review' | 'Resolved' | 'Rejected';

export interface FacilityReport {
  id: string;
  userId: string;
  reporterDisplay: string;
  locationId: string;
  locationName: string;
  category: ReportCategory;
  description: string;
  photoDataUrl?: string;
  status: ReportStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityItem {
  id: string;
  kind: 'event' | 'announcement' | 'study-group' | 'recommendation';
  title: string;
  body: string;
  locationId?: string;
  locationName?: string;
  startsAt?: string;
  authorName: string;
  authorId: string;
  isDemoData: boolean;
  flaggedCount: number;
  moderationStatus: 'approved' | 'flagged' | 'hidden';
  participantsCount?: number;
  joinedByCurrentUser?: boolean;
  createdAt: string;
}

export interface AdminAuditEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

export type ActiveTab = 'home' | 'study' | 'scan' | 'map' | 'community' | 'account' | 'admin';
