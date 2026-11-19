# CS32005 Mobile Application Development — Deliverables Package

## 1. Android & iOS Build Instructions (Expo EAS)
The `/expo-app` directory contains the Expo Router + TypeScript mobile source structure (`Expo Camera`, `Expo Location`, `Expo SQLite`).

### Prerequisites
- Node.js 20+
- Expo CLI & EAS CLI (`npm install -g eas-cli`)
- Physical Android/iOS device or Android Studio / Xcode simulator (required for hardware camera & GPS verification)

### Steps
1. `cd expo-app && npm install`
2. Configure `EXPO_PUBLIC_API_BASE_URL` pointing to your deployed CampusPulse backend URL.
3. Run development server: `npx expo start`
4. Build Android APK/AAB: `eas build --platform android --profile preview`
5. Build iOS Simulator / TestFlight build (macOS + Apple Developer account required): `eas build --platform ios --profile preview`

---

## 2. Five-Minute Demonstration Script
- **0:00–0:45 — Identity & Dundee Context**: Open Home Dashboard. Point out independent student project disclosure, live Dundee UK time, live Open-Meteo Dundee weather, and City Campus focus (with Phase 2 roadmap for Ninewells & Kirkcaldy).
- **0:45–1:45 — Smart Study Space Finder**: Open Study Spaces tab. Filter by *Quiet Study* and *Power Sockets* to highlight the Main Library on Smalls Wynd. Explain community-reported occupancy and staleness indicator. Submit a live occupancy update and show it persist across reload.
- **1:45–2:45 — QR Code Check-In & Check-Out**: Open QR Scanner tab. Demonstrate camera scanner / accessible token entry using a signed CampusPulse QR token. Show duplicate check-in protection, active session timer, Check-Out, and History log.
- **2:45–3:45 — Interactive OpenStreetMap & Accessibility**: Open Campus Map. Show all 20 verified Dundee City Campus buildings, toggle GPS / manual starting building fallback, show walking distance & route line, toggle Dark Mode and Text Size scaling (122%).
- **3:45–4:30 — Community, Facility Reporting & Admin RBAC**: Submit a facility report (e.g., faulty socket in Main Library) noting it goes to CampusPulse admins. Switch to Admin account, generate a new scannable PNG QR code, move the report to *Under review*, and inspect the Admin Audit Log.
- **4:30–5:00 — Offline Cache & Security Summary**: Briefly toggle offline mode / show cached data banner and summarize `firestore.rules` + `SECURITY.md`.

---

## 3. CS32005 Assessment Checklist
- [x] **Functionality & Implementation (30%)**: Auth, Firestore rules, Express API, 20 City Campus buildings, Study Space Finder, QR Check-In/Out, Map, Community, Facility Reporting, Admin Portal.
- [x] **UX & Optimisation (20%)**: Custom Dundee navy/electric blue theme, Dark/Light mode, text scaling, >=44px touch targets, thumb-zone mobile nav, skeleton loading.
- [x] **Testing & Debugging (20%)**: `node:test` unit suite, ESLint security rules check, browser E2E verification via Playwright, `TESTING.md` report.
- [x] **Report Quality & Documentation (20%)**: `SECURITY.md`, `TESTING.md`, `docs/FIREBASE_AND_DATABASE.md`, report outline below.
- [x] **Project Demonstration (10%)**: Live deployed web/PWA + 5-minute demonstration script + Expo source package.

---

## 4. Two-Page Report Outline
- **Page 1 — Architecture, Design & Implementation**:
  1. *Problem Context & Ethical Boundaries*: Helping Dundee students locate study spaces and navigate City Campus without misrepresenting unofficial data as University Estates/Library live feeds.
  2. *System Architecture*: React/Expo TypeScript client, Express HMAC/API layer, Cloud Firestore (`firestore.rules`), Open-Meteo & OpenStreetMap integration, offline cache strategy.
  3. *UX & Accessibility Decisions*: High-contrast navy/blue palette, Dark Mode, dynamic text scaling, camera & GPS non-hardware fallbacks.
- **Page 2 — Security, Testing & Critical Reflection**:
  4. *Security by Design*: Scrypt hashing, HMAC-signed QR tokens, server-enforced RBAC, Eight Pillars Firestore rules, threat limitations.
  5. *Verification & Testing*: Summary of unit tests (`node:test`), security rule linting, and end-to-end browser verification results (citing actual pass/blocked statuses from `TESTING.md`).
  6. *Reflection & Future Work*: Lessons from offline sync, hardware testing constraints (iOS simulator/device builds), and Phase 2 Ninewells & Kirkcaldy Campus expansion.
