import { createClient } from '@supabase/supabase-js';
import { isValidSession } from '../../lib/adminAuth.js';

function cleanSupabaseUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

async function nextCertificateId(supabase) {
  const year = new Date().getFullYear();
  const prefix = `TS-${year}-`;

  const { data, error } = await supabase
    .from('certificates')
    .select('id')
    .like('id', `${prefix}%`);

  if (error) throw error;

  let maxSeq = 0;
  for (const row of data || []) {
    const m = String(row.id).match(/-(\d{4,})$/);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }

  const next = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${next}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!isValidSession(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  try {
    const { application_id, role, project, skills, start_date, end_date } = req.body || {};

    if (!application_id || !role || !project || !skills || !start_date || !end_date) {
      return res.status(400).json({ ok: false, error: 'Missing required fields.' });
    }

    const rawSupabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!rawSupabaseUrl || !supabaseServiceKey) {
      console.error('Server Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
      return res.status(500).json({ ok: false, error: 'Server configuration error.' });
    }

    const supabase = createClient(cleanSupabaseUrl(rawSupabaseUrl), supabaseServiceKey);

    const { data: application, error: appErr } = await supabase
      .from('applications')
      .select('id, full_name, certificate_id')
      .eq('id', application_id)
      .maybeSingle();

    if (appErr) {
      console.error('Supabase fetch application error:', appErr);
      return res.status(500).json({ ok: false, error: 'Failed to load applicant.' });
    }
    if (!application) {
      return res.status(404).json({ ok: false, error: 'Applicant not found.' });
    }
    if (application.certificate_id) {
      return res.status(409).json({
        ok: false,
        error: `This applicant already has a certificate: ${application.certificate_id}`
      });
    }

    const certId = await nextCertificateId(supabase);

    const { error: insertErr } = await supabase.from('certificates').insert({
      id: certId,
      intern_name: application.full_name,
      role,
      project,
      skills,
      start_date,
      end_date
    });

    if (insertErr) {
      console.error('Supabase insert certificate error:', insertErr);
      return res.status(500).json({ ok: false, error: 'Failed to create certificate.' });
    }

    const { error: updateErr } = await supabase
      .from('applications')
      .update({ status: 'completed', certificate_id: certId })
      .eq('id', application_id);

    if (updateErr) {
      console.error('Supabase update application error:', updateErr);
      return res.status(207).json({
        ok: true,
        certificate_id: certId,
        verify_url: `https://intern.thinkstick.in/verify?id=${certId}`,
        warning: 'Certificate created, but failed to update the applicant record. Update it manually.'
      });
    }

    return res.status(200).json({
      ok: true,
      certificate_id: certId,
      verify_url: `https://intern.thinkstick.in/verify?id=${certId}`
    });
  } catch (err) {
    console.error('Unexpected error in admin/issue-certificate handler:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong on the server.' });
  }
}
