import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  computeOccupancyFromSignals,
  decodeWmoWeatherCode,
  parseQrCodeTokenString,
  validateFacilityReportInput,
  validateRegistrationInput,
} from './src/utils/campusLogic';
import type {
  OccupancyLevel,
  ReportStatus,
  StudySpaceSummary,
  WeatherSummary,
} from './src/types/campus';
import {
  generateId,
  hashPassword,
  signQrToken,
  signSessionToken,
  verifyPassword,
  verifyQrSignature,
  verifySessionToken,
} from './server/crypto';
import { getStore, sanitizeUserProfile, saveStore, type StoredUser } from './server/store';

const PORT = Number(process.env.PORT || 3000);
const COOKIE_NAME = 'cp_session';

// Simple sliding-window rate limiter per IP + route bucket
const rateBuckets = new Map<string, number[]>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function getAuthenticatedUser(req: express.Request): StoredUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const token = cookies[COOKIE_NAME] || bearer;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const store = getStore();
  return store.users.find((u) => u.id === payload.uid) || null;
}

function setSessionCookie(res: express.Response, user: StoredUser) {
  const token = signSessionToken({
    uid: user.id,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

// Weather cache (10 minutes)
let cachedWeather: { data: WeatherSummary; expiresAt: number } | null = null;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Ensure store is initialized
  getStore();

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'CampusPulse Dundee API' });
  });

  // Live Open-Meteo weather for Dundee (56.4620, -2.9707)
  app.get('/api/weather', async (_req, res) => {
    const now = Date.now();
    if (cachedWeather && now < cachedWeather.expiresAt) {
      res.json(cachedWeather.data);
      return;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=56.4620&longitude=-2.9707&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Europe%2FLondon';
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = (await response.json()) as {
        current?: {
          temperature_2m: number;
          apparent_temperature: number;
          weather_code: number;
          wind_speed_10m: number;
        };
      };
      if (!json.current) throw new Error('Missing current weather payload');
      const summary: WeatherSummary = {
        temperatureC: Math.round(json.current.temperature_2m * 10) / 10,
        apparentTemperatureC: Math.round(json.current.apparent_temperature * 10) / 10,
        windSpeedKmh: Math.round(json.current.wind_speed_10m),
        weatherCode: json.current.weather_code,
        conditionLabel: decodeWmoWeatherCode(json.current.weather_code),
        fetchedAt: new Date().toISOString(),
        source: 'Open-Meteo Live',
      };
      cachedWeather = { data: summary, expiresAt: now + 10 * 60_000 };
      res.json(summary);
    } catch {
      if (cachedWeather) {
        res.json({ ...cachedWeather.data, source: 'Cached Fallback' });
        return;
      }
      res.json({
        temperatureC: 9,
        apparentTemperatureC: 6,
        windSpeedKmh: 16,
        weatherCode: 3,
        conditionLabel: 'Partly cloudy (offline estimate)',
        fetchedAt: new Date().toISOString(),
        source: 'Cached Fallback',
      } satisfies WeatherSummary);
    }
  });

  // --- Authentication Endpoints ---
  app.get('/api/auth/me', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ user: null });
      return;
    }
    res.json({ user: sanitizeUserProfile(user) });
  });

  app.post('/api/auth/register', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`reg:${ip}`, 15, 60_000)) {
      res.status(429).json({ error: 'Too many registration attempts. Please wait a minute.' });
      return;
    }
    const { email = '', password = '', displayName = '', courseOrSubject = '' } = req.body ?? {};
    const valid = validateRegistrationInput({ email, password, displayName });
    if (valid.ok === false) {
      res.status(400).json({ error: valid.error });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const store = getStore();
    if (store.users.some((u) => u.email === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    const verificationToken = generateId('vrf');
    const newUser: StoredUser = {
      id: generateId('usr'),
      email: normalizedEmail,
      emailVerified: false,
      role: 'student', // Always enforced server-side; client cannot self-promote
      displayName: String(displayName).trim().slice(0, 60),
      courseOrSubject: String(courseOrSubject || '').trim().slice(0, 80),
      studyPreferences: ['Quiet study'],
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
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(String(password)),
      verificationToken,
      resetToken: null,
      resetTokenExpiresAt: null,
    };
    store.users.push(newUser);
    saveStore(store);
    setSessionCookie(res, newUser);
    res.status(201).json({
      user: sanitizeUserProfile(newUser),
      verificationNotice:
        'Account created. For testing without an external SMTP server, use the verification code in your account panel.',
      demoVerificationToken: verificationToken,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`login:${ip}`, 25, 60_000)) {
      res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
      return;
    }
    const { email = '', password = '' } = req.body ?? {};
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const store = getStore();
    const user = store.users.find((u) => u.email === normalizedEmail);
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    setSessionCookie(res, user);
    res.json({ user: sanitizeUserProfile(user) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  app.post('/api/auth/verify-email', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const { token } = req.body ?? {};
    const store = getStore();
    const target = store.users.find((u) => u.id === user.id);
    if (!target) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    if (target.emailVerified) {
      res.json({ user: sanitizeUserProfile(target) });
      return;
    }
    if (!token || token !== target.verificationToken) {
      res.status(400).json({ error: 'Invalid verification token.' });
      return;
    }
    target.emailVerified = true;
    target.verificationToken = null;
    saveStore(store);
    res.json({ user: sanitizeUserProfile(target) });
  });

  app.post('/api/auth/request-verification', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const store = getStore();
    const target = store.users.find((u) => u.id === user.id);
    if (!target) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    if (!target.verificationToken) {
      target.verificationToken = generateId('vrf');
      saveStore(store);
    }
    res.json({ demoVerificationToken: target.verificationToken });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email = '' } = req.body ?? {};
    const normalizedEmail = String(email).trim().toLowerCase();
    const store = getStore();
    const target = store.users.find((u) => u.email === normalizedEmail);
    if (!target) {
      // Do not leak account existence in standard message
      res.json({
        message: 'If that email exists in CampusPulse, a password reset code has been generated.',
      });
      return;
    }
    const resetToken = generateId('rst');
    target.resetToken = resetToken;
    target.resetTokenExpiresAt = Date.now() + 30 * 60_000;
    saveStore(store);
    res.json({
      message: 'Password reset token generated (valid 30 minutes).',
      demoResetToken: resetToken,
    });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { email = '', token = '', newPassword = '' } = req.body ?? {};
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!newPassword || String(newPassword).length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const store = getStore();
    const target = store.users.find((u) => u.email === normalizedEmail);
    if (
      !target ||
      !target.resetToken ||
      target.resetToken !== token ||
      !target.resetTokenExpiresAt ||
      Date.now() > target.resetTokenExpiresAt
    ) {
      res.status(400).json({ error: 'Invalid or expired reset token.' });
      return;
    }
    target.passwordHash = hashPassword(String(newPassword));
    target.resetToken = null;
    target.resetTokenExpiresAt = null;
    saveStore(store);
    res.json({ ok: true, message: 'Password updated. You can now sign in.' });
  });

  app.patch('/api/auth/profile', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const store = getStore();
    const target = store.users.find((u) => u.id === user.id);
    if (!target) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    const body = req.body ?? {};
    if (typeof body.displayName === 'string') {
      const name = body.displayName.trim();
      if (name.length < 2 || name.length > 60) {
        res.status(400).json({ error: 'Display name must be 2–60 characters.' });
        return;
      }
      target.displayName = name;
    }
    if (typeof body.courseOrSubject === 'string') {
      target.courseOrSubject = body.courseOrSubject.trim().slice(0, 80);
    }
    if (Array.isArray(body.studyPreferences)) {
      target.studyPreferences = body.studyPreferences
        .filter((x: unknown) => typeof x === 'string')
        .slice(0, 8);
    }
    if (typeof body.accessibilityPreferences === 'string') {
      target.accessibilityPreferences = body.accessibilityPreferences.trim().slice(0, 200);
    }
    if (typeof body.avatarUrl === 'string' && (body.avatarUrl === '' || body.avatarUrl.startsWith('data:image/'))) {
      target.avatarUrl = body.avatarUrl.slice(0, 300_000);
    }
    if (body.notificationPreferences && typeof body.notificationPreferences === 'object') {
      target.notificationPreferences = {
        campusAnnouncements: Boolean(body.notificationPreferences.campusAnnouncements),
        studySpaceAlerts: Boolean(body.notificationPreferences.studySpaceAlerts),
        reportUpdates: Boolean(body.notificationPreferences.reportUpdates),
      };
    }
    if (body.privacyPreferences && typeof body.privacyPreferences === 'object') {
      target.privacyPreferences = {
        allowGpsNavigation: Boolean(body.privacyPreferences.allowGpsNavigation),
        anonymousOccupancyReports: Boolean(body.privacyPreferences.anonymousOccupancyReports),
      };
    }
    // Note: role is NEVER editable via profile endpoint
    saveStore(store);
    res.json({ user: sanitizeUserProfile(target) });
  });

  app.delete('/api/auth/account', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (user.role === 'admin') {
      res.status(403).json({ error: 'Seeded administrator accounts cannot self-delete here.' });
      return;
    }
    const store = getStore();
    store.users = store.users.filter((u) => u.id !== user.id);
    store.checkIns = store.checkIns.filter((c) => c.userId !== user.id);
    store.facilityReports = store.facilityReports.filter((r) => r.userId !== user.id);
    saveStore(store);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  // --- Locations & Study Spaces ---
  app.get('/api/locations', (_req, res) => {
    const store = getStore();
    res.json({ locations: store.locations });
  });

  app.patch('/api/locations/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator permission required.' });
      return;
    }
    const store = getStore();
    const loc = store.locations.find((l) => l.id === req.params.id);
    if (!loc) {
      res.status(404).json({ error: 'Location not found.' });
      return;
    }
    const { description, accessNote, accessibilityInfo, openingHoursNote, accessibilityVerified } =
      req.body ?? {};
    if (typeof description === 'string' && description.trim().length >= 10) {
      loc.description = description.trim().slice(0, 600);
    }
    if (typeof accessNote === 'string') loc.accessNote = accessNote.trim().slice(0, 400);
    if (typeof accessibilityInfo === 'string') {
      loc.accessibilityInfo = accessibilityInfo.trim().slice(0, 500);
    }
    if (typeof openingHoursNote === 'string') {
      loc.openingHoursNote = openingHoursNote.trim().slice(0, 200);
    }
    if (typeof accessibilityVerified === 'boolean') {
      loc.accessibilityVerified = accessibilityVerified;
    }
    store.auditLogs.unshift({
      id: generateId('aud'),
      adminId: user.id,
      adminEmail: user.email,
      action: 'UPDATE_LOCATION_INFO',
      targetType: 'location',
      targetId: loc.id,
      details: `Updated verified details for ${loc.name}`,
      createdAt: new Date().toISOString(),
    });
    saveStore(store);
    res.json({ location: loc });
  });

  app.get('/api/study-spaces', (_req, res) => {
    const store = getStore();
    const now = Date.now();
    const studySpaces: StudySpaceSummary[] = store.locations
      .filter((loc) => loc.isStudySpace)
      .map((loc) => {
        const activeCheckIns = store.checkIns.filter(
          (c) => c.locationId === loc.id && c.status === 'active'
        ).length;
        const reports = store.occupancyReports.filter((r) => r.locationId === loc.id);
        const computed = computeOccupancyFromSignals(
          activeCheckIns,
          reports.map((r) => ({ level: r.level, createdAt: r.createdAt })),
          now
        );
        return {
          ...loc,
          occupancy: computed.occupancy,
          occupancySource:
            activeCheckIns > 0 || reports.length > 0
              ? 'CampusPulse check-ins & community reports'
              : 'No recent reports',
          activeCheckIns,
          lastUpdatedAt: computed.lastUpdatedAt,
          isStale: computed.isStale,
          recentReportsCount: reports.length,
        };
      });
    res.json({ studySpaces });
  });

  // --- Community Occupancy Reports ---
  app.post('/api/occupancy', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`occ:${ip}`, 20, 60_000)) {
      res.status(429).json({ error: 'Rate limit exceeded for occupancy updates.' });
      return;
    }
    const { locationId, level, anonymous } = req.body ?? {};
    const store = getStore();
    const loc = store.locations.find((l) => l.id === locationId && l.isStudySpace);
    if (!loc) {
      res.status(400).json({ error: 'Selected location is not a registered study space.' });
      return;
    }
    if (!['Low', 'Medium', 'Busy'].includes(level)) {
      res.status(400).json({ error: 'Occupancy level must be Low, Medium, or Busy.' });
      return;
    }
    const user = getAuthenticatedUser(req);
    const record = {
      id: generateId('occ'),
      locationId: loc.id,
      level: level as Exclude<OccupancyLevel, 'Unknown'>,
      userId: anonymous || !user ? null : user.id,
      pseudonym: anonymous || !user ? 'Anonymous student' : user.displayName,
      createdAt: new Date().toISOString(),
    };
    store.occupancyReports.unshift(record);
    // Keep last 500 reports
    store.occupancyReports = store.occupancyReports.slice(0, 500);
    saveStore(store);
    res.status(201).json({ report: record });
  });

  // --- QR Code Check-In & Check-Out ---
  app.get('/api/qr/public-samples', (_req, res) => {
    // Provides active QR labels/tokens for student testing in the browser without exposing admin controls
    const store = getStore();
    const active = store.qrCodes
      .filter((q) => q.active && Date.parse(q.expiresAt) > Date.now())
      .map((q) => ({
        id: q.id,
        locationId: q.locationId,
        locationName: q.locationName,
        label: q.label,
        token: q.token,
        expiresAt: q.expiresAt,
      }));
    res.json({ codes: active });
  });

  app.get('/api/qr/history', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ activeSession: null, history: [] });
      return;
    }
    const store = getStore();
    const mine = store.checkIns
      .filter((c) => c.userId === user.id)
      .sort((a, b) => Date.parse(b.checkedInAt) - Date.parse(a.checkedInAt));
    const activeSession = mine.find((c) => c.status === 'active') || null;
    res.json({ activeSession, history: mine });
  });

  app.post('/api/qr/checkin', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please sign in to check in at a CampusPulse study location.' });
      return;
    }
    const { token = '' } = req.body ?? {};
    const parsed = parseQrCodeTokenString(String(token));
    if (!parsed.validFormat || !parsed.locationId || !parsed.codeId || !parsed.expiresAtMs || !parsed.signature) {
      res.status(400).json({ error: 'Invalid QR code format. Only CampusPulse Dundee QR codes are accepted.' });
      return;
    }
    if (!verifyQrSignature(parsed.locationId, parsed.codeId, parsed.expiresAtMs, parsed.signature)) {
      res.status(403).json({ error: 'QR code signature verification failed.' });
      return;
    }
    if (Date.now() > parsed.expiresAtMs) {
      res.status(410).json({ error: 'This CampusPulse QR code has expired.' });
      return;
    }
    const store = getStore();
    const qrRecord = store.qrCodes.find(
      (q) => q.id === parsed.codeId && q.locationId === parsed.locationId
    );
    if (!qrRecord || !qrRecord.active) {
      res.status(403).json({ error: 'This QR code has been deactivated or is unregistered.' });
      return;
    }
    const existingActive = store.checkIns.find(
      (c) => c.userId === user.id && c.status === 'active'
    );
    if (existingActive) {
      res.status(409).json({
        error: `You already have an active check-in at ${existingActive.locationName}. Please check out first.`,
      });
      return;
    }
    const session = {
      id: generateId('chk'),
      userId: user.id,
      locationId: qrRecord.locationId,
      locationName: qrRecord.locationName,
      qrCodeId: qrRecord.id,
      checkedInAt: new Date().toISOString(),
      checkedOutAt: null,
      status: 'active' as const,
    };
    store.checkIns.unshift(session);
    saveStore(store);
    res.status(201).json({ session });
  });

  app.post('/api/qr/checkout', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const store = getStore();
    const active = store.checkIns.find((c) => c.userId === user.id && c.status === 'active');
    if (!active) {
      res.status(404).json({ error: 'No active check-in session found.' });
      return;
    }
    active.status = 'completed';
    active.checkedOutAt = new Date().toISOString();
    saveStore(store);
    res.json({ session: active });
  });

  // --- Facility Issue Reporting ---
  app.get('/api/reports', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ reports: [] });
      return;
    }
    const store = getStore();
    const list =
      user.role === 'admin'
        ? store.facilityReports
        : store.facilityReports.filter((r) => r.userId === user.id);
    res.json({ reports: list });
  });

  app.post('/api/reports', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please sign in to submit a facility report.' });
      return;
    }
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`rep:${ip}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many report submissions. Please wait a minute.' });
      return;
    }
    const { locationId = '', category = '', description = '', photoDataUrl } = req.body ?? {};
    const valid = validateFacilityReportInput({ locationId, category, description, photoDataUrl });
    if (valid.ok === false) {
      res.status(400).json({ error: valid.error });
      return;
    }
    const store = getStore();
    const loc = store.locations.find((l) => l.id === locationId);
    if (!loc) {
      res.status(400).json({ error: 'Selected campus location does not exist.' });
      return;
    }
    const nowIso = new Date().toISOString();
    const report = {
      id: generateId('rep'),
      userId: user.id,
      reporterDisplay: user.displayName,
      locationId: loc.id,
      locationName: loc.name,
      category,
      description: String(description).trim(),
      photoDataUrl: typeof photoDataUrl === 'string' && photoDataUrl ? photoDataUrl : undefined,
      status: 'Submitted' as ReportStatus,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.facilityReports.unshift(report);
    saveStore(store);
    res.status(201).json({ report });
  });

  app.patch('/api/reports/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator permission required to review reports.' });
      return;
    }
    const store = getStore();
    const report = store.facilityReports.find((r) => r.id === req.params.id);
    if (!report) {
      res.status(404).json({ error: 'Facility report not found.' });
      return;
    }
    const { status, adminNotes } = req.body ?? {};
    if (!['Submitted', 'Under review', 'Resolved', 'Rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }
    report.status = status as ReportStatus;
    if (typeof adminNotes === 'string') {
      report.adminNotes = adminNotes.trim().slice(0, 400);
    }
    report.updatedAt = new Date().toISOString();
    store.auditLogs.unshift({
      id: generateId('aud'),
      adminId: user.id,
      adminEmail: user.email,
      action: 'UPDATE_REPORT_STATUS',
      targetType: 'facility_report',
      targetId: report.id,
      details: `Set report status for ${report.locationName} to ${report.status}`,
      createdAt: new Date().toISOString(),
    });
    saveStore(store);
    res.json({ report });
  });

  // --- Student Community & Announcements ---
  app.get('/api/community', (req, res) => {
    const user = getAuthenticatedUser(req);
    const store = getStore();
    const items = store.communityItems.filter((item) => {
      if (user?.role === 'admin') return true;
      return item.moderationStatus !== 'hidden';
    });
    res.json({ items });
  });

  app.post('/api/community', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please sign in to post to the student community.' });
      return;
    }
    const { kind, title = '', body = '', locationId, startsAt } = req.body ?? {};
    if (!['event', 'announcement', 'study-group', 'recommendation'].includes(kind)) {
      res.status(400).json({ error: 'Invalid community post type.' });
      return;
    }
    if (kind === 'announcement' && user.role !== 'admin') {
      res.status(403).json({ error: 'Only administrators can publish official CampusPulse announcements.' });
      return;
    }
    const cleanTitle = String(title).trim();
    const cleanBody = String(body).trim();
    if (cleanTitle.length < 4 || cleanTitle.length > 120) {
      res.status(400).json({ error: 'Title must be 4–120 characters.' });
      return;
    }
    if (cleanBody.length < 10 || cleanBody.length > 800) {
      res.status(400).json({ error: 'Details must be 10–800 characters.' });
      return;
    }
    const store = getStore();
    const loc = locationId ? store.locations.find((l) => l.id === locationId) : undefined;
    const item = {
      id: generateId('comm'),
      kind,
      title: cleanTitle,
      body: cleanBody,
      locationId: loc?.id,
      locationName: loc?.name,
      startsAt: typeof startsAt === 'string' && startsAt ? startsAt : undefined,
      authorName: user.displayName,
      authorId: user.id,
      isDemoData: false,
      flaggedCount: 0,
      moderationStatus: 'approved' as const,
      participantsCount: kind === 'study-group' || kind === 'event' ? 1 : undefined,
      createdAt: new Date().toISOString(),
    };
    store.communityItems.unshift(item);
    if (kind === 'announcement') {
      store.auditLogs.unshift({
        id: generateId('aud'),
        adminId: user.id,
        adminEmail: user.email,
        action: 'CREATE_ANNOUNCEMENT',
        targetType: 'community',
        targetId: item.id,
        details: `Published announcement: ${item.title}`,
        createdAt: new Date().toISOString(),
      });
    }
    saveStore(store);
    res.status(201).json({ item });
  });

  app.post('/api/community/:id/flag', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sign in to flag content for moderation.' });
      return;
    }
    const store = getStore();
    const item = store.communityItems.find((c) => c.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }
    item.flaggedCount += 1;
    item.moderationStatus = 'flagged';
    saveStore(store);
    res.json({ item });
  });

  app.post('/api/community/:id/join', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sign in to RSVP or join a study group.' });
      return;
    }
    const store = getStore();
    const item = store.communityItems.find((c) => c.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Item not found.' });
      return;
    }
    item.participantsCount = (item.participantsCount ?? 0) + 1;
    saveStore(store);
    res.json({ item });
  });

  // --- Admin Endpoints ---
  app.get('/api/admin/overview', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator access denied.' });
      return;
    }
    const store = getStore();
    res.json({
      stats: {
        totalUsers: store.users.length,
        totalLocations: store.locations.length,
        activeCheckIns: store.checkIns.filter((c) => c.status === 'active').length,
        totalCheckIns: store.checkIns.length,
        openReports: store.facilityReports.filter(
          (r) => r.status === 'Submitted' || r.status === 'Under review'
        ).length,
        occupancySubmissions: store.occupancyReports.length,
        flaggedCommunityItems: store.communityItems.filter((c) => c.moderationStatus === 'flagged')
          .length,
      },
      qrCodes: store.qrCodes,
      occupancySubmissions: store.occupancyReports.slice(0, 25),
      auditLogs: store.auditLogs.slice(0, 50),
    });
  });

  app.post('/api/admin/qr', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator permission required.' });
      return;
    }
    const { locationId = '', label = '', expiresInDays = 90 } = req.body ?? {};
    const store = getStore();
    const loc = store.locations.find((l) => l.id === locationId);
    if (!loc) {
      res.status(400).json({ error: 'Valid locationId required.' });
      return;
    }
    const cleanLabel = String(label).trim();
    if (cleanLabel.length < 3 || cleanLabel.length > 80) {
      res.status(400).json({ error: 'Label must be 3–80 characters.' });
      return;
    }
    const days = Math.max(1, Math.min(365, Number(expiresInDays) || 90));
    const expiresAtMs = Date.now() + days * 86400_000;
    const codeId = generateId('qr');
    const record = {
      id: codeId,
      locationId: loc.id,
      locationName: loc.name,
      label: cleanLabel,
      token: signQrToken(loc.id, codeId, expiresAtMs),
      active: true,
      expiresAt: new Date(expiresAtMs).toISOString(),
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };
    store.qrCodes.unshift(record);
    store.auditLogs.unshift({
      id: generateId('aud'),
      adminId: user.id,
      adminEmail: user.email,
      action: 'GENERATE_QR_CODE',
      targetType: 'qr_code',
      targetId: record.id,
      details: `Generated QR code "${record.label}" for ${loc.name}`,
      createdAt: new Date().toISOString(),
    });
    saveStore(store);
    res.status(201).json({ qrCode: record });
  });

  app.patch('/api/admin/qr/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator permission required.' });
      return;
    }
    const store = getStore();
    const qr = store.qrCodes.find((q) => q.id === req.params.id);
    if (!qr) {
      res.status(404).json({ error: 'QR code not found.' });
      return;
    }
    qr.active = Boolean(req.body?.active);
    store.auditLogs.unshift({
      id: generateId('aud'),
      adminId: user.id,
      adminEmail: user.email,
      action: qr.active ? 'ACTIVATE_QR_CODE' : 'REVOKE_QR_CODE',
      targetType: 'qr_code',
      targetId: qr.id,
      details: `${qr.active ? 'Activated' : 'Revoked'} QR code ${qr.label}`,
      createdAt: new Date().toISOString(),
    });
    saveStore(store);
    res.json({ qrCode: qr });
  });

  app.patch('/api/admin/community/:id', (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator permission required.' });
      return;
    }
    const store = getStore();
    const item = store.communityItems.find((c) => c.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Community post not found.' });
      return;
    }
    const status = req.body?.moderationStatus;
    if (!['approved', 'flagged', 'hidden'].includes(status)) {
      res.status(400).json({ error: 'Invalid moderation status.' });
      return;
    }
    item.moderationStatus = status;
    store.auditLogs.unshift({
      id: generateId('aud'),
      adminId: user.id,
      adminEmail: user.email,
      action: 'MODERATE_COMMUNITY_ITEM',
      targetType: 'community',
      targetId: item.id,
      details: `Set "${item.title}" moderation status to ${status}`,
      createdAt: new Date().toISOString(),
    });
    saveStore(store);
    res.json({ item });
  });

  // Frontend serving (Vite dev middleware in dev, dist/ static in prod)
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusPulse Dundee server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
