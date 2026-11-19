# Firebase, Cloud Firestore & API Integration Guide

## 1. Provisioned Firebase Project
- **Project ID**: `astral-ray-0f900`
- **Firestore Database ID**: `ai-studio-campuspulsedunde-e2487451-1272-4d23-af19-a123f023baa2`
- **Client Config File**: `firebase-applet-config.json`

## 2. Enabling Additional Firebase Auth Providers (Optional for Mobile)
Google Sign-In is enabled out-of-the-box. To enable native Firebase **Email/Password** authentication directly in the Firebase Console:
1. Open Firebase Console -> Project `astral-ray-0f900` -> **Authentication** -> **Sign-in method**.
2. Click **Add new provider** -> **Email/Password** -> **Enable** -> **Save**.
3. For Expo React Native native builds, register the Android (`packageName`) and iOS (`bundleIdentifier`) apps under **Project Settings** and download `google-services.json` / `GoogleService-Info.plist`.

## 3. Firestore Collections (`firebase-blueprint.json` & `firestore.rules`)
- `/users/{userId}` — Private student profile (owner & admin only)
- `/admins/{adminUid}` — Server/console-managed admin registry
- `/locations/{locationId}` — Verified University of Dundee City Campus buildings
- `/studySpaceOccupancy/{locationId}` — Publicly readable non-PII study space occupancy summary
- `/occupancyReports/{reportId}` — Individual student occupancy submissions
- `/checkIns/{sessionId}` — Voluntary QR check-in/check-out records
- `/facilityReports/{reportId}` — CampusPulse facility issue reports
- `/communityItems/{itemId}` — Community events, study groups, recommendations & announcements
- `/adminAuditLogs/{logId}` — Immutable administrative audit trail

## 4. External Public APIs (Zero Paid Keys)
- **Open-Meteo Weather API**: `https://api.open-meteo.com/v1/forecast?latitude=56.4620&longitude=-2.9707&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Europe%2FLondon` (proxied and cached for 10 minutes via `/api/weather`).
- **OpenStreetMap**: Tile layer `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` rendered via Leaflet (`CampusMapView.tsx`) with straight-line campus walking distance and optional external OSRM foot routing link.
