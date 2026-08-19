-- ============================================================
-- DarkSyntax / ThinkStick — Intern Certificates — Supabase Table Setup
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- (Same project as applications table — see supabase-setup.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS certificates (
  id               TEXT PRIMARY KEY,                 -- e.g. 'TS-2026-0007'
  intern_name      TEXT NOT NULL,
  role             TEXT NOT NULL,                     -- e.g. 'AI/ML Intern'
  project          TEXT NOT NULL,                      -- what they contributed to
  skills           TEXT NOT NULL,                       -- comma-separated
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'valid'
                     CHECK (status IN ('valid', 'revoked')),
  mentor           TEXT NOT NULL DEFAULT 'SANJJAY — Founder, DarkSyntax',
  udyam_no         TEXT NOT NULL DEFAULT 'UDYAM-PY-03-0058394',
  cert_pdf_url     TEXT,                                -- optional hosted PDF/PNG link
  issued_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);

-- Enable Row Level Security
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Service role key (used by our API, /api/certificate.js) bypasses RLS
-- automatically — same pattern as the `applications` table. No public-facing
-- read/write policies needed: the verify page hits /api/certificate?id=...
-- server-side, never Supabase directly.

-- ============================================================
-- Issuing a certificate (run manually per intern, or via a small
-- admin script using the SUPABASE_SERVICE_KEY already set in Vercel):
-- ============================================================
-- INSERT INTO certificates
--   (id, intern_name, role, project, skills, start_date, end_date)
-- VALUES
--   ('TS-2026-0007', 'Kawinnath R.', 'AI/ML Intern',
--    'ThinkStick offline inference CLI — model loader & quantization pipeline',
--    'Python, llama.cpp, GGUF quantization, CLI tooling',
--    '2026-05-01', '2026-07-15');

-- To revoke a certificate later:
-- UPDATE certificates SET status = 'revoked' WHERE id = 'TS-2026-0007';

-- ============================================================
-- DONE! View / edit certificates in:
-- Supabase Dashboard → Table Editor → certificates
-- Public verification happens at: intern.thinkstick.in/verify?id=...
-- ============================================================
