import crypto from 'node:crypto';

const SESSION_SECRET =
  process.env.CAMPUSPULSE_SESSION_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + ':campuspulse-session-v1').digest('hex');

const QR_SECRET =
  process.env.CAMPUSPULSE_QR_SECRET ||
  crypto.createHash('sha256').update(process.cwd() + ':campuspulse-qr-v1').digest('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface SessionPayload {
  uid: string;
  role: 'student' | 'admin';
  exp: number;
}

export function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function signQrToken(locationId: string, codeId: string, expiresAtMs: number): string {
  const payload = `CP-DUNDEE:${locationId}:${codeId}:${expiresAtMs}`;
  const hmac = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 24);
  return `${payload}:${hmac}`;
}

export function verifyQrSignature(
  locationId: string,
  codeId: string,
  expiresAtMs: number,
  signature: string
): boolean {
  const payload = `CP-DUNDEE:${locationId}:${codeId}:${expiresAtMs}`;
  const expected = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 24);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}
