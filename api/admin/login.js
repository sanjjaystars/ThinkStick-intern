import { verifyPassword, createSessionToken, SESSION_COOKIE_MAX_AGE } from '../../lib/adminAuth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const { password } = req.body || {};

    if (!process.env.ADMIN_PASSWORD_HASH || !process.env.ADMIN_SESSION_SECRET) {
      console.error('Admin auth env vars missing');
      return res.status(500).json({ ok: false, error: 'Server not configured for admin login.' });
    }

    if (!verifyPassword(password)) {
      return res.status(401).json({ ok: false, error: 'Incorrect password' });
    }

    const token = createSessionToken();
    res.setHeader(
      'Set-Cookie',
      `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE}`
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}
