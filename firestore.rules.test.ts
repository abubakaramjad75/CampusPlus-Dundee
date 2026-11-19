import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

const rulesSource = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

/**
 * Extracts a top-level collection match block from firestore.rules by collection name.
 */
function getCollectionBlock(collectionName: string): string {
  const marker = `match /${collectionName}/`;
  const idx = rulesSource.indexOf(marker);
  assert.ok(idx !== -1, `Missing match block for collection /${collectionName}`);
  const newlineIdx = rulesSource.indexOf('\n', idx);
  const startBrace = rulesSource.lastIndexOf('{', newlineIdx === -1 ? rulesSource.length : newlineIdx);
  let depth = 0;
  for (let i = startBrace; i < rulesSource.length; i++) {
    if (rulesSource[i] === '{') depth++;
    if (rulesSource[i] === '}') {
      depth--;
      if (depth === 0) {
        return rulesSource.slice(idx, i + 1);
      }
    }
  }
  throw new Error(`Unclosed brace in match block for /${collectionName}`);
}

test('Pillar 0: rules_version = 2 and default-deny catch-all is first block', () => {
  assert.match(rulesSource, /^rules_version\s*=\s*'2';/);
  const firstMatchIdx = rulesSource.indexOf('match /{document=**}');
  const firstSpecificMatchIdx = rulesSource.indexOf('match /test/connection');
  assert.ok(firstMatchIdx !== -1, 'Default-deny match /{document=**} must exist');
  assert.ok(
    firstMatchIdx < firstSpecificMatchIdx,
    'Default-deny catch-all must appear before all specific collection match blocks'
  );
  assert.match(
    rulesSource.slice(firstMatchIdx, firstMatchIdx + 120),
    /allow\s+read,\s*write:\s*if\s+false;/
  );
});

test('Phase 1 & 6: Every collection in firebase-blueprint.json has an explicit match block', () => {
  const blueprintCollections = Object.keys(blueprint.firestore).map((p) =>
    p.split('/').filter(Boolean)[0]
  );
  for (const col of blueprintCollections) {
    const block = getCollectionBlock(col);
    assert.ok(block.includes('allow '), `Collection /${col} must define explicit allow clauses`);
  }
});

test('RBAC Primitives: Admin and Student roles are DB/verified-email backed (never custom claims)', () => {
  assert.ok(!rulesSource.includes('request.auth.token.role'), 'Must never trust custom token role claims');
  assert.ok(!rulesSource.includes('request.auth.token.admin'), 'Must never trust custom token admin claims');
  assert.match(rulesSource, /function\s+isVerifiedUser\(\)\s*\{\s*return\s+isSignedIn\(\)\s*&&\s*request\.auth\.token\.email_verified\s*==\s*true;/);
  assert.match(rulesSource, /function\s+isAdmin\(\)/);
  assert.match(rulesSource, /function\s+isStudent\(\)/);
  assert.match(rulesSource, /exists\(\/databases\/\$\(database\)\/documents\/admins\/\$\(request\.auth\.uid\)\)/);
  assert.match(rulesSource, /get\(\/databases\/\$\(database\)\/documents\/users\/\$\(request\.auth\.uid\)\)\.data\.role\s*==\s*'student'/);
});

test('Pillar 4 Rule 2: No allow get/list/delete rules reference incoming() or request.resource', () => {
  const lines = rulesSource.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*allow\s+(get|list|read|delete):/.test(line)) {
      let stmt = line;
      let j = i;
      while (!stmt.includes(';') && j + 1 < lines.length) {
        j++;
        stmt += '\n' + lines[j];
      }
      assert.ok(
        !stmt.includes('incoming(') && !stmt.includes('request.resource'),
        `Forbidden incoming()/request.resource in read/delete rule near line ${i + 1}: ${stmt}`
      );
    }
  }
});

test('Dirty Dozen 1-3: User profile isolation, no self-admin escalation, no ghost fields', () => {
  const usersBlock = getCollectionBlock('users');
  const userValidatorMatch = rulesSource.match(/function\s+isValidUserProfile\(data\)\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(userValidatorMatch, 'isValidUserProfile helper must exist');
  const userValidator = userValidatorMatch[0];

  // 1. Self-Admin Escalation blocked
  assert.ok(userValidator.includes("data.role == 'student'"), 'Users must only create student role');
  assert.ok(usersBlock.includes('incoming().role == existing().role'), 'Users cannot mutate role on update');

  // 2. Ghost Shadow Fields blocked
  assert.ok(userValidator.includes('data.keys().hasAll(') && userValidator.includes('data.keys().hasOnly('));
  assert.ok(usersBlock.includes('affectedKeys().hasOnly('));

  // 3. Cross-User PII Read & Student List blocked
  assert.match(usersBlock, /allow\s+get:.*isOwner\(userId\)\s*\|\|\s*isAdmin\(\)/);
  assert.match(usersBlock, /allow\s+list:\s*if\s+isAdmin\(\);/);
});

test('Dirty Dozen 4-8: Report list scoping, identity integrity, email verification, timestamps, ID poisoning', () => {
  const reportsBlock = getCollectionBlock('facilityReports');
  const checkInsBlock = getCollectionBlock('checkIns');

  // 4. Blanket List Scrape blocked
  assert.match(reportsBlock, /allow\s+list:\s*if\s+isVerifiedUser\(\)\s*&&\s*\(resource\.data\.userId\s*==\s*request\.auth\.uid\s*\|\|\s*isAdmin\(\)\)/);

  // 5. Identity Spoofing blocked
  assert.ok(reportsBlock.includes('incoming().userId == request.auth.uid'));

  // 6. Unverified Email Write blocked (isStudentOrAdmin requires isVerifiedUser)
  assert.ok(reportsBlock.includes('isStudentOrAdmin()'));

  // 7. Spoofed Timestamp blocked
  assert.ok(checkInsBlock.includes('incoming().checkedInAt == request.time'));
  assert.ok(reportsBlock.includes('incoming().createdAt == request.time'));
  assert.ok(reportsBlock.includes('incoming().updatedAt == request.time'));

  // 8. ID Poisoning bounded to <= 128 chars regex
  assert.match(rulesSource, /id\.size\(\)\s*<=\s*128\s*&&\s*id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
  assert.ok(reportsBlock.includes('isValidId(reportId)'));
});

test('Dirty Dozen 9-12 & Admin RBAC: Terminal locks, announcement gating, immutable audit logs, admin-only governance', () => {
  const reportsBlock = getCollectionBlock('facilityReports');
  const communityBlock = getCollectionBlock('communityItems');
  const checkInsBlock = getCollectionBlock('checkIns');
  const auditBlock = getCollectionBlock('adminAuditLogs');
  const locationsBlock = getCollectionBlock('locations');
  const qrBlock = getCollectionBlock('qrCodes');
  const adminsBlock = getCollectionBlock('admins');

  // 9. Student cannot resolve/reject own report (terminal locked once past Submitted)
  assert.ok(reportsBlock.includes("existing().status == 'Submitted'"));
  assert.ok(reportsBlock.includes("incoming().status == 'Submitted'"));
  assert.ok(reportsBlock.includes("affectedKeys().hasOnly(['description', 'updatedAt'])"));
  assert.ok(reportsBlock.includes("isAdmin()"));

  // 10. Non-admin cannot create announcement
  assert.ok(communityBlock.includes("incoming().kind != 'announcement' || isAdmin()"));

  // 11. Re-opening completed check-in blocked for students
  assert.ok(checkInsBlock.includes("existing().status == 'active'"));
  assert.ok(checkInsBlock.includes("incoming().status == 'completed'"));

  // 12. Admin audit logs strictly immutable (even for admins)
  assert.match(auditBlock, /allow\s+get:\s*if\s+isValidId\(logId\)\s*&&\s*isAdmin\(\);/);
  assert.match(auditBlock, /allow\s+list:\s*if\s+isAdmin\(\);/);
  assert.match(auditBlock, /allow\s+update,\s*delete:\s*if\s+false;/);

  // Admin registry cannot be listed or written by any client
  assert.match(adminsBlock, /allow\s+list:\s*if\s+false;/);
  assert.match(adminsBlock, /allow\s+create,\s*update,\s*delete:\s*if\s+false;/);

  // Campus locations and QR code registry mutations restricted to admins
  assert.match(locationsBlock, /allow\s+create:[\s\S]*isAdmin\(\)/);
  assert.match(locationsBlock, /allow\s+update:[\s\S]*isAdmin\(\)/);
  assert.match(locationsBlock, /allow\s+delete:[\s\S]*isAdmin\(\)/);
  assert.match(qrBlock, /allow\s+list:\s*if\s+isAdmin\(\);/);
  assert.match(qrBlock, /allow\s+create:[\s\S]*isAdmin\(\)/);
});

test('All string validations include explicit .size() bounds', () => {
  const stringTypeChecks = [...rulesSource.matchAll(/([a-zA-Z0-9_.[\]]+)\s+is\s+string/g)];
  assert.ok(stringTypeChecks.length >= 20, 'Expected at least 20 string type checks across entities');
  for (const m of stringTypeChecks) {
    const fieldExpr = m[1];
    const startIdx = m.index ?? 0;
    const window = rulesSource.slice(startIdx, startIdx + 120);
    assert.ok(
      window.includes(`${fieldExpr}.size()`) || window.includes('isValidId('),
      `String check "${m[0]}" near index ${startIdx} must enforce .size() bounds`
    );
  }
});
