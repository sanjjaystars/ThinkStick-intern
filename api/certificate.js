import { createClient } from '@supabase/supabase-js';

// ── Helper to normalize Supabase URL (same as api/apply.js) ─────────────────────
function cleanSupabaseUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

// ── Handler ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS (same-origin in practice, but kept consistent with apply.js)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const rawSupabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!rawSupabaseUrl || !supabaseServiceKey) {
      console.error('Server Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
      return res.status(500).json({
        ok: false,
        error: 'Server configuration error: Database credentials missing.'
      });
    }

    const supabaseUrl = cleanSupabaseUrl(rawSupabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const id = (req.query.id || '').toString().trim();
    if (!id) {
      return res.status(400).json({ ok: false, error: 'Missing certificate id' });
    }

    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch certificate.' });
    }

    if (!data) {
      return res.status(404).json({ ok: false, error: 'Certificate not found' });
    }

    return res.status(200).json({ ok: true, certificate: data });

  } catch (err) {
    console.error('Unexpected error in certificate handler:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong on the server.' });
  }
}
