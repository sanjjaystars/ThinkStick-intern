import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

function cleanSupabaseUrl(url) {
  if (!url) return '';
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}

function fmtLongDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtShortDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      color: { dark: '#1E1E1E', light: '#FAF5EF' }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cert.id}.pdf"`);

    const CREAM = '#FAF5EF';
    const BLACK = '#1E1E1E';
    const ORANGE = '#E15B33';
    const ORANGE_LIGHT = '#F0A63F';
    const RED_DARK = '#C23B2B';
    const MUTED = '#7A7570';
    const LINE = '#DED6C8';

    const W = 1000, H = 707;
    const doc = new PDFDocument({ size: [W, H], margin: 0 });
    doc.pipe(res);

    doc.rect(0, 0, W, H).fill(CREAM);

    function diamond(cx, cy, size, fillColor, strokeColor, strokeOnly) {
      doc.save();
      doc.rotate(45, { origin: [cx, cy] });
      const r = doc.roundedRect(cx - size / 2, cy - size / 2, size, size, size * 0.08);
      if (strokeOnly) {
        r.lineWidth(2.5).stroke(strokeColor);
      } else {
        r.fill(fillColor);
      }
      doc.restore();
    }

    doc.save();
    doc.rect(860, 0, 140, H).clip();
    diamond(950, 40, 130, RED_DARK, null, false);
    diamond(870, 130, 90, ORANGE_LIGHT, null, false);
    diamond(960, 230, 70, null, ORANGE, true);
    diamond(880, 320, 110, null, RED_DARK, true);
    diamond(970, 420, 60, ORANGE_LIGHT, null, false);
    diamond(890, 500, 85, null, ORANGE, true);
    diamond(960, 590, 100, RED_DARK, null, false);
    diamond(880, 670, 70, ORANGE_LIGHT, null, false);
    doc.restore();

    const marginX = 70;
    doc.font('Helvetica-Bold').fontSize(46).fillColor(BLACK);
    doc.text('Certificate', marginX, 52);
    doc.fillColor(ORANGE);
    doc.text('of Internship', marginX, 104);

    doc.font('Helvetica').fontSize(13).fillColor(MUTED);
    doc.text('This is to certify that', marginX, 178);

    doc.font('Helvetica-Bold').fontSize(32).fillColor(BLACK);
    doc.text(cert.intern_name, marginX, 200);

    const nameWidth = doc.widthOfString(cert.intern_name);
    doc.moveTo(marginX, 250).lineTo(Math.max(marginX + nameWidth + 200, 560), 250).lineWidth(1).stroke(LINE);

    const paraWidth = 640;
    const paraY = 278;
    doc.font('Helvetica').fontSize(13.5).fillColor(BLACK);
    doc.text('Has successfully completed the internship at ', marginX, paraY, { continued: true, width: paraWidth, lineGap: 6 });
    doc.font('Helvetica-Bold').fillColor(ORANGE);
    doc.text('DarkSyntax', { continued: true });
    doc.font('Helvetica').fillColor(BLACK);
    doc.text(' from ', { continued: true });
    doc.font('Helvetica-Bold').fillColor(ORANGE);
    doc.text(`${fmtLongDate(cert.start_date)} to ${fmtLongDate(cert.end_date)}`, { continued: true });
    doc.font('Helvetica').fillColor(BLACK);
    doc.text(', in the field of ', { continued: true });
    doc.font('Helvetica-Bold').fillColor(ORANGE);
    doc.text(cert.role, { continued: true });
    doc.font('Helvetica').fillColor(BLACK);
    doc.text('.');

    const skills = (cert.skills || '').split(',').map(s => s.trim()).filter(Boolean);
    doc.font('Helvetica').fontSize(12.5).fillColor(MUTED);
    doc.text('Worked with tools & skills including:', marginX, 348);

    let tagX = marginX, tagY = 376;
    const tagH = 30, tagGap = 10, maxX = marginX + 640;
    doc.font('Helvetica').fontSize(11.5);
    skills.forEach(skill => {
      const tw = doc.widthOfString(skill) + 28;
      if (tagX + tw > maxX) { tagX = marginX; tagY += tagH + tagGap; }
      doc.roundedRect(tagX, tagY, tw, tagH, tagH / 2).lineWidth(1.3).stroke(ORANGE);
      doc.fillColor(BLACK).text(skill, tagX + 14, tagY + 9);
      tagX += tw + tagGap;
    });

    const footerY = 560;
    doc.moveTo(marginX, footerY).lineTo(marginX + 160, footerY).lineWidth(1).stroke(LINE);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BLACK).text(cert.mentor || 'SANJJAY', marginX, footerY + 12);
    doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('Founder, DarkSyntax', marginX, footerY + 30);

    const col2X = marginX + 230;
    doc.moveTo(col2X, footerY).lineTo(col2X + 160, footerY).lineWidth(1).stroke(LINE);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BLACK).text(cert.udyam_no || 'UDYAM-PY-03-0058394', col2X, footerY + 12);
    doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('Udyam Registration No.', col2X, footerY + 30);

    const col3X = marginX + 460;
    doc.font('Helvetica').fontSize(11.5).fillColor(MUTED).text('Date of issue', col3X, footerY - 4);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(BLACK).text(fmtShortDate(cert.issued_at || cert.created_at), col3X, footerY + 12);
    doc.font('Helvetica').fontSize(11.5).fillColor(MUTED).text('Certificate ID', col3X, footerY + 34);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(ORANGE).text(cert.id, col3X, footerY + 50);

    doc.image(qrBuffer, 790, footerY - 6, { width: 62, height: 62 });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Scan to verify', 780, footerY + 58, { width: 82, align: 'center' });

    if (cert.status === 'revoked') {
      doc.save();
      doc.rotate(-18, { origin: [500, 353] });
      doc.font('Helvetica-Bold').fontSize(70).fillColor(RED_DARK).opacity(0.25);
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
