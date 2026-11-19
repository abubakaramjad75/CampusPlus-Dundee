import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceMeters,
  estimateWalkingMinutes,
  computeOccupancyFromSignals,
  isOccupancyStale,
  filterStudySpaces,
  validateFacilityReportInput,
  validateRegistrationInput,
  parseQrCodeTokenString,
  decodeWmoWeatherCode,
} from './campusLogic';
import { VERIFIED_CITY_CAMPUS_LOCATIONS } from '../data/dundeeLocations';
import type { StudySpaceSummary } from '../types/campus';

test('verified Dundee locations dataset includes all 20 City Campus landmarks', () => {
  assert.equal(VERIFIED_CITY_CAMPUS_LOCATIONS.length, 20);
  const mainLib = VERIFIED_CITY_CAMPUS_LOCATIONS.find((l) => l.id === 'main-library');
  assert.ok(mainLib);
  assert.equal(mainLib.postcode, 'DD1 4HN');
  assert.equal(mainLib.accessibilityVerified, true);
});

test('calculateDistanceMeters computes realistic Dundee campus distances', () => {
  const tower = VERIFIED_CITY_CAMPUS_LOCATIONS.find((l) => l.id === 'tower-building')!;
  const library = VERIFIED_CITY_CAMPUS_LOCATIONS.find((l) => l.id === 'main-library')!;
  const meters = calculateDistanceMeters(tower.lat, tower.lng, library.lat, library.lng);
  assert.ok(meters >= 150 && meters <= 300, `Expected ~200m, got ${meters}m`);
  const walkMins = estimateWalkingMinutes(meters);
  assert.ok(walkMins >= 2 && walkMins <= 5);
});

test('computeOccupancyFromSignals marks empty signals as Unknown and stale', () => {
  const res = computeOccupancyFromSignals(0, [], 1_700_000_000_000);
  assert.equal(res.occupancy, 'Unknown');
  assert.equal(res.isStale, true);
  assert.equal(res.lastUpdatedAt, null);
});

test('computeOccupancyFromSignals computes Busy when recent reports and active check-ins are high', () => {
  const now = Date.UTC(2026, 10, 19, 12, 0, 0);
  const res = computeOccupancyFromSignals(
    14,
    [
      { level: 'Medium', createdAt: new Date(now - 5 * 60_000).toISOString() },
      { level: 'Busy', createdAt: new Date(now - 10 * 60_000).toISOString() },
    ],
    now
  );
  assert.equal(res.occupancy, 'Busy');
  assert.equal(res.isStale, false);
});

test('isOccupancyStale detects timestamps older than 60 minutes', () => {
  const now = Date.UTC(2026, 10, 19, 12, 0, 0);
  assert.equal(isOccupancyStale(new Date(now - 30 * 60_000).toISOString(), now), false);
  assert.equal(isOccupancyStale(new Date(now - 90 * 60_000).toISOString(), now), true);
  assert.equal(isOccupancyStale(null, now), true);
});

test('filterStudySpaces prioritises Main Library and enforces verified facility filters', () => {
  const studyLocations: StudySpaceSummary[] = VERIFIED_CITY_CAMPUS_LOCATIONS.filter(
    (l) => l.isStudySpace
  ).map((loc) => ({
    ...loc,
    occupancy: 'Low',
    occupancySource: 'No recent reports',
    activeCheckIns: 0,
    lastUpdatedAt: null,
    isStale: true,
    recentReportsCount: 0,
  }));

  const quietResults = filterStudySpaces(studyLocations, { quietOnly: true });
  assert.equal(quietResults[0].id, 'main-library');
  assert.ok(quietResults.every((s) => s.studyFeatures?.quietZone));

  const socketResults = filterStudySpaces(studyLocations, { socketsOnly: true });
  assert.equal(socketResults.length, 1);
  assert.equal(socketResults[0].id, 'main-library');
});

test('validateFacilityReportInput rejects invalid category or short description', () => {
  const badDesc = validateFacilityReportInput({
    locationId: 'main-library',
    category: 'Faulty sockets',
    description: 'short',
  });
  assert.equal(badDesc.ok, false);

  const badCat = validateFacilityReportInput({
    locationId: 'main-library',
    category: 'NotARealCategory',
    description: 'Two sockets on Floor 2 desk row B are unresponsive.',
  });
  assert.equal(badCat.ok, false);

  const good = validateFacilityReportInput({
    locationId: 'main-library',
    category: 'Faulty sockets',
    description: 'Two sockets on Floor 2 desk row B are unresponsive.',
  });
  assert.equal(good.ok, true);
});

test('validateRegistrationInput validates email, name, and password boundaries', () => {
  assert.equal(
    validateRegistrationInput({
      email: 'not-an-email',
      password: 'password123',
      displayName: 'Ewan',
    }).ok,
    false
  );
  assert.equal(
    validateRegistrationInput({
      email: 'ewan@example.com',
      password: '123',
      displayName: 'Ewan',
    }).ok,
    false
  );
  assert.equal(
    validateRegistrationInput({
      email: 'ewan@example.com',
      password: 'StrongPassword99',
      displayName: 'Ewan MacLeod',
    }).ok,
    true
  );
});

test('parseQrCodeTokenString validates CampusPulse signed token format', () => {
  const valid = parseQrCodeTokenString(
    'CP-DUNDEE:main-library:qr_lib_01:1900000000000:a1b2c3d4e5f60718'
  );
  assert.equal(valid.validFormat, true);
  assert.equal(valid.locationId, 'main-library');
  assert.equal(valid.codeId, 'qr_lib_01');

  const invalid = parseQrCodeTokenString('https://example.com/random');
  assert.equal(invalid.validFormat, false);
});

test('decodeWmoWeatherCode maps WMO codes cleanly', () => {
  assert.equal(decodeWmoWeatherCode(0), 'Clear sky');
  assert.equal(decodeWmoWeatherCode(61), 'Rain');
});
