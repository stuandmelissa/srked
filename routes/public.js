import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';

const router = express.Router();

const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: process.env.NODE_ENV === 'development' ? 100 : 5, standardHeaders: true, legacyHeaders: false });

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function getContent(page) {
  const [rows] = await db.query(
    'SELECT section_key, value FROM content WHERE page = ? ORDER BY sort_order', [page]
  );
  const content = {};
  rows.forEach(r => { content[r.section_key] = r.value || ''; });
  return content;
}

async function getGlobalData() {
  const [navPages]    = await db.query('SELECT slug, nav_label, page_type FROM pages WHERE show_in_nav=1 AND is_active=1 ORDER BY sort_order');
  const [services]    = await db.query('SELECT * FROM services WHERE is_active=1 ORDER BY sort_order');
  const [socialLinks] = await db.query('SELECT * FROM social_links WHERE is_enabled=1 ORDER BY sort_order');
  return { navPages, services, socialLinks };
}

async function sendContactEmail(contact) {
  if (!process.env.RESEND_API_KEY) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'SRK Consulting <noreply@updates.srked.com>',
      to: process.env.EMAIL_TO || 'info@srked.com',
      subject: `New message from ${contact.name} — SRK Consulting`,
      html: `
        <h2 style="color:#1B3A6B;">New Contact Form Submission</h2>
        <table style="border-collapse:collapse;width:100%;max-width:500px;">
          <tr><td style="padding:8px;font-weight:bold;">Name</td><td style="padding:8px;">${escapeHtml(contact.name)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;"><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Phone</td><td style="padding:8px;">${escapeHtml(contact.phone || 'N/A')}</td></tr>
        </table>
        <h3 style="color:#1B3A6B;margin-top:20px;">Message</h3>
        <p style="white-space:pre-wrap;background:#f8f9fa;padding:15px;border-radius:6px;">${escapeHtml(contact.message)}</p>
      `
    })
  });
  if (!res.ok) throw new Error(`Resend API error: ${res.status}`);
}

// ─── Core pages ──────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const [content, global] = await Promise.all([getContent('home'), getGlobalData()]);
    res.render('index', { title: 'SRK Consulting', page: 'home', content, ...global });
  } catch (err) { next(err); }
});

router.get('/about', async (req, res, next) => {
  try {
    const [content, global] = await Promise.all([getContent('about'), getGlobalData()]);
    res.render('about', { title: 'About — SRK Consulting', page: 'about', content, ...global });
  } catch (err) { next(err); }
});

router.get('/services', async (req, res, next) => {
  try {
    const [content, global] = await Promise.all([getContent('services'), getGlobalData()]);
    res.render('services', { title: 'Services — SRK Consulting', page: 'services', content, ...global });
  } catch (err) { next(err); }
});

router.get('/contact', async (req, res, next) => {
  try {
    const [content, global] = await Promise.all([getContent('contact'), getGlobalData()]);
    res.render('contact', { title: 'Contact — SRK Consulting', page: 'contact', content, error: null, ...global });
  } catch (err) { next(err); }
});

router.post('/contact', contactLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;
    const global = await getGlobalData();
    const content = await getContent('contact');

    const fail = (msg) => res.render('contact', {
      title: 'Contact — SRK Consulting', page: 'contact', content, error: msg, ...global
    });

    if (!name || !email || !message) return fail('Please fill in your name, email, and message.');
    if (name.length > 200 || email.length > 200 || message.length > 5000)
      return fail('One or more fields exceeded the maximum allowed length.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Please enter a valid email address.');

    await db.query(
      'INSERT INTO contacts (name, email, phone, message) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim(), phone ? phone.trim() : null, message.trim()]
    );
    sendContactEmail({ name: name.trim(), email: email.trim(), phone: phone?.trim(), message: message.trim() })
      .catch(err => console.error('Email send failed:', err.message));

    res.redirect('/contact/success');
  } catch (err) { next(err); }
});

router.get('/contact/success', async (req, res, next) => {
  try {
    const global = await getGlobalData();
    res.render('contact-success', { title: 'Message Sent — SRK Consulting', page: 'contact', ...global });
  } catch (err) { next(err); }
});

// ─── Dynamic pages (testimonials, faq, resources, pricing, etc.) ──────────────

router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const [[page]] = await db.query(
      'SELECT * FROM pages WHERE slug = ? AND is_active = 1', [slug]
    );
    if (!page) return next(); // fall through to 404

    const global = await getGlobalData();
    const baseLocals = { page: slug, navPages: global.navPages, services: global.services, socialLinks: global.socialLinks };

    if (page.page_type === 'testimonials') {
      const [items] = await db.query('SELECT * FROM testimonials WHERE is_active=1 ORDER BY sort_order, id');
      const content = await getContent(slug);
      return res.render('testimonials', { title: `${page.title} — SRK Consulting`, content, items, ...baseLocals });
    }
    if (page.page_type === 'faq') {
      const [items] = await db.query('SELECT * FROM faq_items ORDER BY sort_order, id');
      const content = await getContent(slug);
      return res.render('faq', { title: `${page.title} — SRK Consulting`, content, items, ...baseLocals });
    }
    if (page.page_type === 'resources') {
      const [items] = await db.query('SELECT * FROM resources ORDER BY sort_order, id');
      const content = await getContent(slug);
      return res.render('resources', { title: `${page.title} — SRK Consulting`, content, items, ...baseLocals });
    }
    if (page.page_type === 'pricing') {
      const content = await getContent(slug);
      return res.render('pricing', { title: `${page.title} — SRK Consulting`, content, ...baseLocals });
    }

    next();
  } catch (err) { next(err); }
});

export default router;
