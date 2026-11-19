# CampusPulse Dundee — Security Specification (Phase 0 TDD)

## 1. Role-Based Access Control (RBAC) & Default-Deny Matrix

Every path defaults to **DENY** via the leading catch-all `match /{document=**} { allow read, write: if false; }`.

| Collection Path | Unauthenticated / Unverified | Verified Student (`isStudent()`) | Administrator (`isAdmin()`) |
| :--- | :--- | :--- | :--- |
| `/{document=**}` (unlisted paths) | Deny all | Deny all | Deny all |
| `/test/connection` | `get` probe only (`list` denied) | `get` probe only (`list` denied) | `get` probe only (`list` denied) |
| `/admins/{adminUid}` | Deny all | `get` own UID doc only (`list`/write denied) | `get` (`list`/write denied) |
| `/users/{userId}` | Deny all | `get`, `create` (`role == 'student'`), `update` non-RBAC fields, `delete` own UID (`list` denied) | `get`, `list`, `delete` |
| `/locations/{locationId}` | Deny all | `get`, `list` only | `get`, `list`, `create`, `update`, `delete` |
| `/qrCodes/{codeId}` | Deny all | `get` only (`list`/write denied) | `get`, `list`, `create`, `update`, `delete` |
| `/studySpaceOccupancy/{locationId}` | Deny all | `get`, `list`, `create`, `update` (schema + `request.time`) | `get`, `list`, `create`, `update` |
| `/occupancyReports/{reportId}` | Deny all | `get`, `list` own `userId`, `create` own (`update`/`delete` denied) | `get`, `list`, `create` (`update`/`delete` denied) |
| `/checkIns/{sessionId}` | Deny all | `get`, `list` own, `create` active, `update` active -> completed, `delete` own | `get`, `list`, `create`, `update`, `delete` |
| `/facilityReports/{reportId}` | Deny all | `get`, `list` own, `create` (`status == 'Submitted'`), `update` description while `'Submitted'`, `delete` while `'Submitted'` | `get`, `list`, `update` (`status`, `adminNotes`, `updatedAt`), `delete` |
| `/communityItems/{itemId}` | Deny all | `get`/`list` approved or own, `create` non-announcement, `update` flag/join/own-approved, `delete` own-approved | `get`, `list`, `create` (incl. announcements), `update`, `delete` |
| `/adminAuditLogs/{logId}` | Deny all | Deny all | `get`, `list`, `create` (`update`/`delete` denied) |

## 2. Core Data Invariants
1. **Default-Deny Catch-All**: Unspecified collections and subcollections reject all reads and writes (`match /{document=**} { allow read, write: if false; }`).
2. **No Self-Promoted Admins**: A user creating `/users/{userId}` MUST set `role == 'student'` and cannot mutate `role` on update. Admin privileges are verified strictly via `/admins/{uid}` existence or the verified bootstrap administrator email (`email_verified == true`), never client-supplied custom claims.
3. **PII Isolation**: `/users/{userId}` documents (containing email and voluntary accessibility preferences) are readable only by `request.auth.uid == userId` or `isAdmin()`. Students cannot `list /users`.
4. **Strict Path & Schema Keys**: Every collection validates document IDs (`^[a-zA-Z0-9_-]+$`), enforces `hasAll` + `hasOnly` on `create`, and enforces `affectedKeys().hasOnly(...)` on `update`.
5. **Relational Integrity**: `qrCodes` creation verifies `exists(/databases/$(database)/documents/locations/$(incoming().locationId))`. Student-owned records bind `userId == request.auth.uid` on `create` and keep `userId` immutable on `update`.
6. **Terminal State Locking**: Once a `checkIns` document reaches `status == 'completed'`, non-admins cannot re-open or alter it. Once a `facilityReports` document leaves `Submitted` (`Under review`, `Resolved`, `Rejected`), students cannot edit or delete it.
7. **Temporal Integrity**: `createdAt`, `updatedAt`, and `checkedInAt` MUST equal `request.time`.
8. **Admin-Only Governance & Immutable Audit Logs**: Non-admins cannot create `kind == 'announcement'` in `/communityItems`, cannot modify `/locations` or `/qrCodes`, and cannot read or write `/adminAuditLogs`. Even administrators cannot `update` or `delete` `/adminAuditLogs`.

## 3. "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Self-Admin Escalation**: `POST /users/{uid}` with `{ role: "admin" }`.
2. **Ghost Shadow Field**: `POST /users/{uid}` with valid fields plus `{ isVerifiedStaff: true }`.
3. **Cross-User PII Read**: `GET /users/{otherUid}` as a standard signed-in student.
4. **Blanket List Scrape**: `LIST /facilityReports` as a standard student without `where("userId", "==", uid)`.
5. **Identity Spoofing on Report**: `POST /facilityReports/{id}` with `userId: "someone_else"`.
6. **Unverified Email Write**: `POST /facilityReports/{id}` when `request.auth.token.email_verified == false`.
7. **Spoofed Timestamp**: `POST /checkIns/{id}` with client-backdated `checkedInAt`.
8. **ID Poisoning**: `POST /facilityReports/<2000_char_id>` violating `isValidId()`.
9. **Student Closing/Approving Own Report**: `PATCH /facilityReports/{id}` by report author trying to set `status: "Resolved"`.
10. **Non-Admin Creating Announcement**: `POST /communityItems/{id}` with `kind: "announcement"` by student.
11. **Re-opening Completed Check-In**: `PATCH /checkIns/{id}` setting `status: "active"` after `status == "completed"`.
12. **Tampering with Admin Audit Log**: `PATCH` or `DELETE /adminAuditLogs/{id}` even by an admin.
