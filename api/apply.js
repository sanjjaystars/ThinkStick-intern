import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// ── Helper to normalize Supabase URL ──────────────────────────────────
function cleanSupabaseUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

// ── Validation (mirrors frontend rules) ────────────────────────────────
const validators = {
  fullName:  v => typeof v === 'string' && v.trim().length >= 2,
  email:     v => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  phone:     v => {
    if (typeof v !== 'string') return false;
    const digits = v.replace(/\D/g, '').slice(-10);
    return /^[6-9]\d{9}$/.test(digits);
  },
  college:   v => typeof v === 'string' && v.trim().length >= 2,
  year:      v => typeof v === 'string' && v.trim().length > 0,
  track:     v => typeof v === 'string' && v.trim().length > 0,
  why:       v => typeof v === 'string' && v.trim().length >= 20,
};

function validate(data) {
  const errors = [];
  for (const [field, check] of Object.entries(validators)) {
    if (!check(data[field])) errors.push(field);
  }
  return errors;
}

// ── Email template ─────────────────────────────────────────────────────
function buildEmailHTML(d) {
  return `
  <div style="font-family:'JetBrains Mono',monospace,sans-serif;background:#0A0C0E;color:#F2EFE9;padding:40px 32px;max-width:600px;">
    <div style="border-bottom:2px solid #FFB000;padding-bottom:16px;margin-bottom:24px;">
      <h1 style="font-size:18px;color:#FFB000;margin:0;">NEW INTERNSHIP APPLICATION</h1>
      <p style="font-size:12px;color:#8A8F94;margin:6px 0 0;">ref: ${d.reference}</p>
    </div>

    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="color:#8A8F94;padding:8px 16px 8px 0;white-space:nowrap;vertical-align:top;">Name</td><td style="padding:8px 0;">${d.fullName}</td></tr>
      <tr><td style="color:#8A8F94;padding:8px 16px 8px 0;white-space:nowrap;vertical-align:top;">Email</td><td style="padding:8px 0;"><a href="mailto:${d.email}" style="color:#00D9B5;">${d.email}</a></td></tr>
      <tr><td style="color:#8A8F94;padding:8px 16px 8px 0;white-space:nowrap;vertical-align:top;">Phone</td><td style="padding:8px 0;"><a href="tel:${d.phone}" style="color:#00D9B5;">${d.phone}</a></td></tr>
      <tr><td style="color:#8A8F94;padding:8px 16px 8px 0;white-space:nowrap;vertical-align:top;">College</td><td style="padding:8px 0;">${d.college}</td></tr>
      <tr><td style="color:#8A8F94;padding:8px 16px 8px 0;white-space:nowrap;vertical-align:top;">Year</td><td style="padding:8px 0;">${d.year}</td></tr>
      <tr><td style="color:#8A8F94;padding:8px 16px 8px 0;white-space:nowrap;vertical-align:top;">Branch</td><td style="padding:8px 0;">${d.branch || '—'}</td></tr>
      <tr><td style="color:#8A8F94;padding:8px 16px 8px 0;white-space:nowrap;vertical-align:top;">Track</td><td style="padding:8px 0;color:#FFB000;font-weight:bold;">${d.track}</td></tr>
      <tr><td style="color:#8A8F94;padding:8px 16px 8px 0;white-space:nowrap;vertical-align:top;">Links</td><td style="padding:8px 0;">${d.links || '—'}</td></tr>
    </table>

    <div style="margin-top:24px;padding:16px;background:#12161A;border:1px solid #22282E;border-radius:4px;">
      <p style="color:#8A8F94;font-size:11px;letter-spacing:1px;margin:0 0 8px;">WHY THIS INTERNSHIP</p>
      <p style="margin:0;line-height:1.65;font-size:14px;">${d.why.replace(/\n/g, '<br>')}</p>
    </div>

    <p style="color:#8A8F94;font-size:11px;margin-top:28px;border-top:1px solid #22282E;padding-top:16px;">
      Submitted at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
      <br>View all applications in your <a href="https://app.supabase.com" style="color:#00D9B5;">Supabase Dashboard</a>
    </p>
  </div>`;
}

// ── Handler ────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const rawSupabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!rawSupabaseUrl || !supabaseServiceKey) {
      console.error('Server Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
      return res.status(500).json({
        ok: false,
        error: 'Server configuration error: Database credentials missing. Please configure environment variables in Vercel.'
      });
    }

    const supabaseUrl = cleanSupabaseUrl(rawSupabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const data = req.body;

    // ── Validate ──
    const errors = validate(data);
    if (errors.length) {
      return res.status(400).json({ ok: false, error: 'Validation failed', fields: errors });
    }

    // ── Generate reference code ──
    const d = new Date();
    const reference = 'DS-' +
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const cleanPhone = data.phone.replace(/\D/g, '').slice(-10);

    // ── Store in Supabase ──
    const { error: dbError } = await supabase
      .from('applications')
      .insert({
        reference,
        full_name: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: cleanPhone,
        college: data.college.trim(),
        year: data.year.trim(),
        branch: data.branch?.trim() || null,
        track: data.track.trim(),
        links: data.links?.trim() || null,
        why: data.why.trim(),
      });

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      return res.status(500).json({ ok: false, error: 'Failed to save application. ' + (dbError.message || '') });
    }

    // ── Send email notification ──
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const notifyEmail = process.env.NOTIFY_EMAIL || 'sanjjay.stars@gmail.com';
        await resend.emails.send({
          from: 'DarkSyntax Internships <onboarding@resend.dev>',
          to: [notifyEmail],
          subject: `🟡 New Intern Application — ${data.fullName.trim()} [${data.track.trim()}]`,
          html: buildEmailHTML({ ...data, phone: cleanPhone, reference }),
        });
      } catch (emailErr) {
        console.error('Email send failed (application still saved):', emailErr);
      }
    } else {
      console.warn('RESEND_API_KEY is not set — email notification skipped.');
    }

    // ── Success ──
    return res.status(200).json({ ok: true, reference });

  } catch (err) {
    console.error('Unexpected error in apply handler:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong on the server. Please try again.' });
  }
}

