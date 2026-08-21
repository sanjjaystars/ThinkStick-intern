import crypto from 'crypto';

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 hours

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('Missing ADMIN_SESSION_SECRET');
  return secret;
}

export function verifyPassword(password) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash || !password) return false;
  const candidate = crypto.createHash('sha256').update(String(password)).digest('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken() {
  const expiry = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const sig = crypto.createHmac('sha256', getSecret()).update(String(expiry)).digest('hex');
  return `${expiry}.${sig}`;
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        const idx = p.indexOf('=');
        if (idx === -1) return [p, ''];
        return [p.slice(0, idx), decodeURIComponent(p.slice(idx + 1))];
      })
  );
}

export function isValidSession(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies['admin_session'];
    if (!token) return false;
    const [expiryStr, sig] = token.split('.');
    if (!expiryStr || !sig) return false;
    const expiry = Number(expiryStr);
    if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
    const expectedSig = crypto.createHmac('sha256', getSecret()).update(expiryStr).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    console.error('Session validation error:', err);
    return false;
  }
}

export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;
