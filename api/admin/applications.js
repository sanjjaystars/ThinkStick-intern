import { createClient } from '@supabase/supabase-js';
import { isValidSession } from '../../lib/adminAuth.js';

function cleanSupabaseUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isValidSession(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  try {
    const rawSupabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!rawSupabaseUrl || !supabaseServiceKey) {
      console.error('Server Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
      return res.status(500).json({ ok: false, error: 'Server configuration error.' });
    }

    const supabase = createClient(cleanSupabaseUrl(rawSupabaseUrl), supabaseServiceKey);

    const { data, error } = await supabase
      .from('applications')
      .select('id, reference, full_name, email, phone, college, year, branch, track, links, why, status, certificate_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to load applications.' });
    }

    return res.status(200).json({ ok: true, applications: data });
  } catch (err) {
    console.error('Unexpected error in admin/applications handler:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong on the server.' });
  }
}
