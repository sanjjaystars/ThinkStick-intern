import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

function cleanSupabaseUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function monthsBetween(start, end) {
  const s = new Date(start), e = new Date(end);
  let m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  if (e.getDate() < s.getDate()) m -= 1;
  return Math.max(m, 1);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const rawSupabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!rawSupabaseUrl || !supabaseServiceKey) {
      console.error('Server Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
      return res.status(500).json({ ok: false, error: 'Server configuration error.' });
    }

    const supabase = createClient(cleanSupabaseUrl(rawSupabaseUrl), supabaseServiceKey);

    const id = (req.query.id || '').toString().trim();
    if (!id) return res.status(400).json({ ok: false, error: 'Missing certificate id' });

    const { data: cert, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to load certificate.' });
    }
    if (!cert) {
      return res.status(404).json({ ok: false, error: 'Certificate not found' });
    }

    const verifyUrl = `https://intern.thinkstick.in/verify?id=${cert.id}`;
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      margin: 1,
      width: 300,
      color: { dark: '#0A0C0E', light: '#F2EFE9' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.id}.pdf"`);

    const doc = new PDFDocument({ size: [1000, 707], margin: 0 });
    doc.pipe(res);

    const VOID = '#0A0C0E', PANEL = '#12161A', COPPER = '#FFB000', COPPER_DIM = '#7A5A1E',
          TEAL = '#00D9B5', TEXT = '#F2EFE9', MUTED = '#8A8F94', LINE = '#22282E';

    const DISP = 'Helvetica-Bold';
    const MONO = 'Courier';
    const MONO_B = 'Courier-Bold';

    doc.rect(0, 0, 1000, 707).fill(VOID);

    doc.roundedRect(23, 23, 954, 661, 8).lineWidth(1).stroke(LINE);
    doc.roundedRect(45, 45, 910, 617, 5).lineWidth(1).stroke(COPPER_DIM);

    const centerText = (text, y, font, size, color, opts = {}) => {
      doc.font(font).fontSize(size).fillColor(color);
      const w = doc.widthOfString(text);
      doc.text(text, (1000 - w) / 2, y, opts);
    };

    centerText('THINKSTICK', 66, DISP, 30, TEXT);
    centerText('OFFLINE AI  ·  ON A DRIVE', 106, MONO, 9, TEAL);
    centerText('a product of DarkSyntax', 120, MONO, 9, MUTED);

    doc.moveTo(455, 146).lineTo(545, 146).lineWidth(1).stroke(COPPER_DIM);

    centerText('[ OK ]  CERTIFICATE OF INTERNSHIP COMPLETION', 160, MONO_B, 11, COPPER);
    centerText('This certifies that', 198, MONO, 11, MUTED);
    centerText(cert.intern_name, 220, DISP, 32, TEXT);

    const nameW = doc.font(DISP).fontSize(32).widthOfString(cert.intern_name);
    doc.moveTo(500 - nameW / 2 - 15, 262).lineTo(500 + nameW / 2 + 15, 262).lineWidth(1.5).stroke(COPPER);

    centerText('has successfully completed an internship as', 282, MONO, 11, MUTED);
    centerText(cert.role, 302, MONO_B, 13, TEAL);
    centerText('at DarkSyntax, contributing to:', 324, MONO, 11, MUTED);

    doc.roundedRect(150, 350, 700, 50, 5).fillAndStroke(PANEL, COPPER_DIM);
    doc.font(MONO).fontSize(10).fillColor(COPPER);
    doc.text(cert.project, 175, 366, { width: 650, align: 'center' });

    const dur = monthsBetween(cert.start_date, cert.end_date);
    centerText(
      `Duration: ${fmtDate(cert.start_date)}  -  ${fmtDate(cert.end_date)}   (${dur} Month${dur !== 1 ? 's' : ''})`,
      420, MONO, 11, TEXT
    );
    centerText(`Skills: ${cert.skills}`, 440, MONO, 9, MUTED);

    const footerY = 510;
    doc.moveTo(80, footerY).lineTo(920, footerY).lineWidth(1).stroke(LINE);

    doc.font(MONO_B).fontSize(11).fillColor(TEXT).text(cert.mentor || 'SANJJAY - Founder, DarkSyntax', 80, footerY + 22);
    doc.font(MONO).fontSize(9).fillColor(MUTED).text('Verified Mentor / Issuing Authority', 80, footerY + 40);
    doc.text(`Udyam Reg. No. ${cert.udyam_no || 'UDYAM-PY-03-0058394'}`, 80, footerY + 56);
    doc.font(MONO_B).fillColor(COPPER).text('darksyntax.xyz', 80, footerY + 72);

    centerText('CERTIFICATE ID', footerY + 18, MONO, 9, MUTED);
    centerText(cert.id, footerY + 33, MONO_B, 15, COPPER);
    centerText('ISSUED', footerY + 60, MONO, 9, MUTED);
    centerText(fmtDate((cert.issued_at || cert.created_at || '').slice(0, 10)), footerY + 74, MONO, 10, TEXT);

    doc.image(qrBuffer, 800, footerY + 8, { width: 90, height: 90 });
    doc.font(MONO).fontSize(8).fillColor(MUTED).text('SCAN TO VERIFY', 800, footerY + 102, { width: 90, align: 'center' });

    centerText(verifyUrl, 635, MONO, 9, MUTED);

    if (cert.status === 'revoked') {
      doc.save();
      doc.rotate(-18, { origin: [500, 353] });
      doc.font(DISP).fontSize(70).fillColor('#FF5C5C').opacity(0.28);
      const revW = doc.widthOfString('REVOKED');
      doc.text('REVOKED', 500 - revW / 2, 320);
      doc.restore();
    }

    doc.end();
  } catch (err) {
    console.error('Certificate file generation error:', err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to generate certificate file.' });
    } else {
      res.end();
    }
  }
}
