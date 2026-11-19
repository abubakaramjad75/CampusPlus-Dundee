# CampusPulse Dundee

**Your Campus. Your Community. Your University.**

CampusPulse Dundee is a student-built web, PWA, and mobile companion app made for students at the **University of Dundee City Campus** (Dundee, Scotland). Built as part of **CS32005 – Mobile Application Development**, it brings together verified campus building details, crowd-sourced study space availability, QR check-ins, walking navigation, live Dundee weather, and campus issue reporting in one place.

> **Quick note before anything else:** CampusPulse Dundee is an independent student project, not an official University of Dundee or DUSA app. Occupancy statuses come from voluntary student check-ins and reports rather than official University Estates or Library sensors, and creating an account here does not verify official University student status.

---

## Why I Built This

Finding a quiet desk around Smalls Wynd during assignment weeks, checking whether a building has step-free access or power sockets, or figuring out how far Dalhousie or the Queen Mother Building is from where you are standing usually means jumping between four different tabs. CampusPulse Dundee tries to pull those everyday City Campus tasks into one fast, accessible app that works both on desktop and in your pocket—even when campus Wi-Fi drops out.

---

## What's Inside

- **20 Verified City Campus Locations** — Covers key Dundee City Campus landmarks including the Main Library (Smalls Wynd), Tower Building, Dalhousie Building, DUSA, Queen Mother Building, Fulton Building, Matthew & Crawford Buildings (DJCAD), Scrymgeour Building, Medical Sciences Institute, and more. Public, student-card, and restricted buildings are clearly distinguished.
- **Smart Study Space Finder** — Puts the Main Library first, lets you filter by verified facilities (quiet zones, group tables, accessibility, eduroam Wi-Fi, power sockets, seating), flags occupancy reports older than 60 minutes as outdated, and lets students post quick Low/Medium/Busy updates.
- **Signed QR Check-In & Check-Out** — Voluntary study-desk check-ins powered by HMAC-SHA256 signed `CP-DUNDEE:...` tokens. Works with your device camera (`jsQR`), QR image uploads, or manual token entry, prevents duplicate active sessions, and tracks your session history.
- **OpenStreetMap Campus Navigation** — Interactive Leaflet map centred on City Campus with GPS support, a manual starting-building fallback if location permissions are off, walking distance/time estimates, and direct links to official University pages.
- **Dundee Clock & Live Weather** — Always shows UK (`Europe/London`) time alongside live Dundee weather pulled from Open-Meteo and cached on the server.
- **Student Community & Facility Reporting** — Browse or share DUSA events, study groups, and campus tips, flag posts for review, or report broken sockets, equipment, or accessibility obstacles straight to CampusPulse admins.
- **Admin Portal & Audit Trail** — Role-protected dashboard for generating and revoking scannable QR codes, triaging student facility reports, moderating community posts, updating campus notes, and reading immutable audit logs.
- **Light/Dark Theme, Accessibility & Offline Support** — Includes Dark Mode, adjustable text sizing, `>=44px` tap targets, subtle 3D card depth and smooth transitions (`prefers-reduced-motion` aware), PWA offline caching, and an Expo React Native companion package in `expo-app/`.

---

## Built With

- **Frontend & PWA:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Service Worker + Web App Manifest
- **Backend:** Node.js, Express, `tsx`, `crypto.scryptSync` + `timingSafeEqual` password hashing, HMAC-SHA256 signed `HttpOnly` session cookies and QR tokens
- **Firebase & Database:** Firebase Auth (Google Sign-In) & Cloud Firestore with role-based, default-deny security rules
- **Maps, Weather & QR:** Leaflet + OpenStreetMap, Open-Meteo API, `qrcode`, `jsQR`
- **Mobile Source:** Expo Router + TypeScript (`expo-app/` with Expo Camera, Location, and SQLite caching)
- **Testing & Linting:** `node:test` (`tsx --test`), `@firebase/eslint-plugin-security-rules`, TypeScript (`tsc --noEmit`), Playwright

---

## Project Layout

```text
.
├── src/
│   ├── components/         # Main views (Home, Study Spaces, QR Scanner, Map, Community, Account, Admin, DepthCard)
│   ├── context/            # App state, theme/text scaling, and offline action queue
│   ├── data/               # 20 verified University of Dundee City Campus locations
│   ├── firebase/           # Firebase client setup, connection probe, and structured error handling
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Pure campus logic, offline cache helpers, and unit tests
├── server/                 # Crypto helpers and JSON store persistence
├── server.ts               # Express API + Vite dev server entry (port 3000)
├── expo-app/               # Expo React Native Android/iOS companion package
├── public/                 # PWA manifest, service worker, and custom app icon
├── docs/                   # CS32005 deliverables & Firebase integration notes
├── firebase-blueprint.json # Firestore collection schemas
├── firestore.rules         # Hardened Firestore RBAC & default-deny rules
├── firestore.rules.test.ts # Security invariants & adversarial payload test suite
├── security_spec.md        # RBAC matrix & security specification
├── SECURITY.md             # Threat model & honest limitations
└── TESTING.md              # Automated & browser verification report
```

---

## Running It Locally

You'll need **Node.js 20+** and **npm**.

1. **Clone the repository and install packages**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Check `.env` and add any runtime variables you need (no secrets are committed to the repo). If you're connecting to Cloud Firestore, make sure `firebase-applet-config.json` is configured for your Firebase project.

3. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Production build**
   ```bash
   npm run build
   npm start
   ```

If you want to run or build the mobile companion in `expo-app/` with Expo CLI or EAS Build, check out [`docs/CS32005_DELIVERABLES.md`](docs/CS32005_DELIVERABLES.md) for the step-by-step Android/iOS notes.

---

## Tests & Checks

```bash
# TypeScript check
npm run lint

# Unit tests + Firestore security rules invariant checks
npx tsx --test src/utils/campusLogic.test.ts firestore.rules.test.ts

# Firestore rules ESLint security audit
npx eslint firestore.rules

# Vite production build
npm run build
```

You can find the full breakdown of what passed, along with honest notes on what couldn't run inside a headless container (like live Firebase Emulator Java tests or physical iOS/Android camera hardware checks), in [`TESTING.md`](TESTING.md).

---

## Security Notes

Security wasn't bolted on at the end—both the Express backend and Cloud Firestore rules enforce strict role boundaries:

- **Default-Deny Firestore Rules:** `firestore.rules` starts with `match /{document=**} { allow read, write: if false; }`.
- **Verified Roles Only:** Admin permissions (`isAdmin()`) are checked against `/admins/{uid}` or the verified bootstrap admin email, and student permissions (`isStudent()`) are checked against `/users/{uid}` (`role == 'student'`). Custom client claims are never trusted, and users cannot promote themselves to admin.
- **PII & Audit Protection:** Student profiles (`/users/{uid}`) can only be read by the account owner or an admin, facility reports lock for students once triaged past `Submitted`, and `/adminAuditLogs` is strictly append-only.

For the full threat model and known limitations (including the lack of official University Shibboleth/Entra ID SSO), read [`SECURITY.md`](SECURITY.md) and [`security_spec.md`](security_spec.md).

---

## Official University of Dundee Links

Always double-check official opening hours, room bookings, and accessibility audits directly with the University:

- [University of Dundee Locations Directory](https://www.dundee.ac.uk/locations)
- [Official Campus Map Download](https://www.dundee.ac.uk/corporate-information/campus-map-download)
- [City Campus Overview](https://www.dundee.ac.uk/student-life/campus/city-campus)
- [Our Libraries (Main Library)](https://www.dundee.ac.uk/library/our-libraries)

---

## What's Next

- **Phase 1 (Current):** University of Dundee **City Campus** (20 verified locations).
- **Phase 2 (Planned):** Expanding coverage to **Ninewells Campus** (School of Medicine) and **Kirkcaldy Campus** (School of Health Sciences).
