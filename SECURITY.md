# CampusPulse Dundee — Security Architecture & Limitations

## 1. Security by Design Overview
CampusPulse Dundee is built as an independent CS32005 student project. Security controls are implemented across both the Cloud Firestore rules layer and the Express API server:

- **Authentication & Password Storage**:
  - Client-side Firebase Authentication supports Google Sign-In (`signInWithPopup`).
  - The Express API supports email/password registration, login, verification, and password reset using Node.js `crypto.scryptSync` with a unique 16-byte random salt per user and constant-time comparison (`crypto.timingSafeEqual`).
  - Passwords and password hashes are never returned in any API response.
- **Session Management**:
  - Sessions use `HttpOnly`, `SameSite=Lax` cookies (`cp_session`) signed with HMAC-SHA256 (`Secure` enabled in production).
- **Role-Based Access Control (RBAC)**:
  - Administrator privileges are strictly enforced server-side (`user.role === 'admin'` on Express endpoints and `isAdmin()` in `firestore.rules` verifying `/admins/$(request.auth.uid)` or verified bootstrap admin email `email_verified == true`).
  - Student privileges are derived via `isStudent()` checking verified email plus `/users/$(request.auth.uid).data.role == 'student'`, never client-supplied custom claims.
  - Self-registration and profile update endpoints strip/reject role changes so users cannot promote themselves to administrator.
- **Hardened Cloud Firestore Security Rules (`firestore.rules`)**:
  - Default-deny catch-all (`match /{document=**} { allow read, write: if false; }`).
  - Strict schema validation (`isValidUserProfile`, `isValidLocation`, `isValidQrCode`, `isValidStudySpaceOccupancy`, `isValidOccupancyReport`, `isValidCheckInSession`, `isValidFacilityReport`, `isValidCommunityItem`, `isValidAdminAuditLog`).
  - Path ID hardening (`isValidId` regex + max 128 chars), string length bounds, `request.time` timestamp integrity, terminal state locking on `checkIns` & `facilityReports`, and action-based `affectedKeys().hasOnly(...)` update gates.
  - PII isolation: `/users/{userId}` is readable only by the owning UID or an admin; `/admins` is non-listable and console/server-managed only.
  - Immutable admin audit logs (`allow update, delete: if false;`).
- **QR Code Integrity**:
  - QR check-in tokens use `CP-DUNDEE:<locationId>:<codeId>:<expiresAtMs>:<hmacHex>` signed server-side with HMAC-SHA256.
  - Server-side validation checks format, HMAC signature, expiration timestamp, active status, and prevents duplicate active check-in sessions per user.
- **Rate Limiting & Abuse Prevention**:
  - Sliding-window rate limiting on registration, login, community occupancy submissions, and facility reports.

## 2. Known Security Limitations (Honest Assessment)
- **No Official University SSO**: CampusPulse does not integrate with University of Dundee Shibboleth/Entra ID; therefore, student identity at the University cannot be cryptographically verified.
- **Demo Email Verification & Password Reset Tokens**: In environments without an external SMTP relay configured, verification/reset tokens are returned in the UI for demonstration testing rather than sent via production email delivery.
- **Firebase App Check**: App Check is recommended before public store release (Android Play Integrity / iOS App Attest / Web reCAPTCHA Enterprise) and is not active in local preview.
- **Anti-Spoofing Limits on Voluntary Check-Ins**: QR stickers can theoretically be photographed and shared; physical rotation of printed QR codes and optional GPS proximity checks mitigate—but do not eliminate—remote check-ins.
- **Local Store Persistence**: The Express server uses `.data/campuspulse-store.json` for local/container persistence; multi-instance horizontal scaling would require migrating all server state exclusively to Cloud Firestore or a managed database.
