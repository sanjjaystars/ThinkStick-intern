-- ============================================================
-- DarkSyntax Internship Applications — Supabase Table Setup
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  college TEXT NOT NULL,
  year TEXT NOT NULL,
  branch TEXT,
  track TEXT NOT NULL,
  links TEXT,
  why TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Service role key (used by our API) bypasses RLS automatically.
-- No public-facing read/write policies needed — data is only
-- accessible via the Supabase dashboard or the server-side API.

-- ============================================================
-- DONE! You can now view submissions in:
-- Supabase Dashboard → Table Editor → applications
-- ============================================================
