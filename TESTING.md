# CampusPulse Dundee — Testing & Debugging Report (CS32005)

Status Legend: **Passed** | **Failed** | **Not tested** | **Blocked**

## 1. Automated Unit Tests (`node:test` via `npx tsx --test src/utils/campusLogic.test.ts`)
- **Dataset Completeness (20 Verified City Campus Locations)**: **Passed**
- **Haversine Distance & Walking Time Calculation**: **Passed**
- **Occupancy Computation & 60-Minute Staleness Detection**: **Passed**
- **Study Space Filtering & Main Library Prioritisation**: **Passed**
- **Facility Report Input & Payload Boundary Validation**: **Passed**
- **Registration Email & Password Validation**: **Passed**
- **Signed CampusPulse QR Token Parsing**: **Passed**
- **Open-Meteo WMO Weather Code Decoding**: **Passed**

## 2. Security & Static Analysis
- **TypeScript Strict Check (`npm run lint` / `tsc --noEmit`)**: **Passed** (0 errors)
- **Production Vite Bundle (`npm run build`)**: **Passed**
- **Firestore Security Rules ESLint (`npx eslint firestore.rules`)**: **Passed** (0 errors/warnings)
- **Firestore Security Rules Invariant & Dirty-Dozen Spec (`npx tsx --test firestore.rules.test.ts`)**: **Passed** (8/8 checks covering default-deny catch-all, blueprint parity, RBAC primitives, and Dirty Dozen guards)
- **Firestore Rules Deployment (`DeployRules` to `astral-ray-0f900`)**: **Passed**

## 3. End-to-End Browser Verification (Playwright Chromium — Desktop 1440×900 & Mobile 390×844)
- **Home Dashboard, Dundee Clock & Live Open-Meteo Weather**: **Passed** (live Dundee weather rendered cleanly, 0 console errors)
- **3D Perspective Depth & Tab Page Transitions**: **Passed** (CSS 3D hover tilt & smooth page transitions verified on desktop & mobile with `prefers-reduced-motion` support)
- **Smart Study Space Finder Filtering & Occupancy Report Submission**: **Passed** (Main Library filtered & occupancy updated to `Low`)
- **Authentication (Student & Admin Login, Sign Out, Role Enforcement)**: **Passed**
- **QR Code Check-In (Signed Token Verification), Duplicate Prevention & Check-Out**: **Passed**
- **Facility Issue Reporting & Admin Queue Visibility**: **Passed**
- **Admin Dashboard (Scannable PNG QR Code Display & Aggregated Stats)**: **Passed**
- **Interactive OpenStreetMap (Leaflet City Campus Markers & Walking Line)**: **Passed**
- **Dark Mode & Mobile Thumb-Zone Navigation (`390×844`)**: **Passed**

## 4. Hardware, Emulator & Native Build Tests (Honest Status)
- **Live Firebase Firestore Emulator Execution**: **Blocked** in this container because Java JRE is not installed (`firestore.rules.test.ts` verifies rules source structure, blueprint parity, and Dirty Dozen invariants statically).
- **Expo Physical Android Camera Barcode Scan (`ExpoQrScanner.tsx`)**: **Not tested** (requires physical Android device / camera hardware outside headless web container; web camera `jsQR` + image upload + manual token entry tested).
- **Expo iOS TestFlight / Simulator Build**: **Blocked** (requires macOS + Xcode + Apple Developer Program account).
- **Real Device GPS Field Walk on Smalls Wynd**: **Not tested** (tested via browser geolocation fallback and manual building origin selector).
