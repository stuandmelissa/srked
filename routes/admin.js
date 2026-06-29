import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

const ALLOWED_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, join(__dirname, '../public/images')),
  filename: (req, file, cb) => cb(null, 'photo.jpg')
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith('image/') && ALLOWED_IMG_EXTS.includes(ext)) cb(null, true);
    else cb(new Error('Only image files (jpg, png, gif, webp) are allowed'));
  }
});

function requireAuth(req, res, next) {
  if (req.session?.adminId) return next();
  res.redirect('/admin/login');
}

async function getAdminGlobals() {
  const [[row]] = await db.query('SELECT COUNT(*) AS cnt FROM contacts WHERE is_read = 0');
  const [navPages] = await db.query('SELECT slug, nav_label, page_type, is_builtin FROM pages WHERE is_active=1 ORDER BY sort_order');
  return { unreadCount: row.cnt, navPages };
}

const BUILTIN_TYPES = ['home', 'about', 'services', 'contact'];

// ─── Login ───────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [[admin]] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.render('admin/login', { error: 'Incorrect username or password.' });
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.adminId = admin.id;
      res.redirect('/admin');
    });
  } catch (err) { next(err); }
});

router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/admin/login')));

// ─── Dashboard root ───────────────────────────────────────────────────────────

router.get('/', requireAuth, (req, res) => res.redirect('/admin/page/home'));

// ─── Content editing (per page) ───────────────────────────────────────────────

router.get('/page/:slug', requireAuth, async (req, res, next) => {
  try {
    const { slug } = req.params;
    const [[page]] = await db.query('SELECT * FROM pages WHERE slug = ?', [slug]);
    if (!page) return res.redirect('/admin/page/home');

    const globals = await getAdminGlobals();

    if (page.page_type === 'testimonials') {
      const [items] = await db.query('SELECT * FROM testimonials ORDER BY sort_order, id');
      return res.render('admin/page-items', { pageName: slug, page, items, itemType: 'testimonials', ...globals });
    }
    if (page.page_type === 'faq') {
      const [items] = await db.query('SELECT * FROM faq_items ORDER BY sort_order, id');
      return res.render('admin/page-items', { pageName: slug, page, items, itemType: 'faq', ...globals });
    }
    if (page.page_type === 'resources') {
      const [items] = await db.query('SELECT * FROM resources ORDER BY sort_order, id');
      return res.render('admin/page-items', { pageName: slug, page, items, itemType: 'resources', ...globals });
    }

    const [fields] = await db.query(
      'SELECT id, section_key, label, content_type, value FROM content WHERE page = ? ORDER BY sort_order', [slug]
    );
    res.render('admin/dashboard', { pageName: slug, page, fields, ...globals });
  } catch (err) { next(err); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', requireAuth, async (req, res, next) => {
  try {
    const [socialLinks] = await db.query('SELECT * FROM social_links ORDER BY sort_order');
    const globals = await getAdminGlobals();
    res.render('admin/dashboard', { pageName: 'settings', page: null, fields: [], socialLinks, ...globals });
  } catch (err) { next(err); }
});

// ─── Services management ──────────────────────────────────────────────────────

router.get('/services', requireAuth, async (req, res, next) => {
  try {
    const [services] = await db.query('SELECT * FROM services ORDER BY sort_order, id');
    const globals = await getAdminGlobals();
    res.render('admin/services', { services, ...globals });
  } catch (err) { next(err); }
});

router.post('/api/services', requireAuth, async (req, res, next) => {
  try {
    const { title, description, icon } = req.body;
    if (!title) return res.status(400).json({ ok: false, error: 'Title is required.' });
    await db.query('INSERT INTO services (title, description, icon, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(s2.sort_order),0)+1 FROM services s2))',
      [title.trim(), (description || '').trim(), (icon || '✏️').trim()]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/services/:id', requireAuth, async (req, res, next) => {
  try {
    const { title, description, icon } = req.body;
    await db.query('UPDATE services SET title=?, description=?, icon=? WHERE id=?',
      [(title || '').trim(), (description || '').trim(), (icon || '✏️').trim(), req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/services/:id/delete', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM services WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Pages management ─────────────────────────────────────────────────────────

router.get('/pages', requireAuth, async (req, res, next) => {
  try {
    const [pages] = await db.query('SELECT * FROM pages ORDER BY sort_order, id');
    const globals = await getAdminGlobals();
    res.render('admin/pages', { pages, ...globals });
  } catch (err) { next(err); }
});

const PAGE_TEMPLATES = {
  testimonials: { title: 'Testimonials', nav_label: 'Testimonials', contentSeed: [
    { section_key: 'page_title', label: 'Page Title', content_type: 'text', value: 'What Families Are Saying', sort_order: 1 },
    { section_key: 'intro_text', label: 'Introduction Text', content_type: 'textarea', value: 'Here is what some of the families I have worked with have shared about their experience.', sort_order: 2 },
  ]},
  faq: { title: 'FAQ', nav_label: 'FAQ', contentSeed: [
    { section_key: 'page_title', label: 'Page Title', content_type: 'text', value: 'Frequently Asked Questions', sort_order: 1 },
    { section_key: 'intro_text', label: 'Introduction Text', content_type: 'textarea', value: 'Have a question? I may have answered it below. If not, please reach out!', sort_order: 2 },
  ]},
  resources: { title: 'Resources', nav_label: 'Resources', contentSeed: [
    { section_key: 'page_title', label: 'Page Title', content_type: 'text', value: 'Helpful Resources', sort_order: 1 },
    { section_key: 'intro_text', label: 'Introduction Text', content_type: 'textarea', value: 'A curated collection of resources to support your student\'s learning journey.', sort_order: 2 },
  ]},
  pricing: { title: 'Pricing', nav_label: 'Pricing', contentSeed: [
    { section_key: 'page_title',  label: 'Page Title',         content_type: 'text',     value: 'Rates & Pricing',  sort_order: 1 },
    { section_key: 'intro_text',  label: 'Introduction Text',  content_type: 'textarea', value: 'I offer flexible rates to fit a variety of needs. Contact me to discuss what works best for your family.', sort_order: 2 },
    { section_key: 'rate_1_title',label: 'Rate 1: Title',      content_type: 'text',     value: 'Initial Consultation', sort_order: 3 },
    { section_key: 'rate_1_price',label: 'Rate 1: Price',      content_type: 'text',     value: 'Free (30 min)', sort_order: 4 },
    { section_key: 'rate_1_desc', label: 'Rate 1: Description',content_type: 'textarea', value: 'A complimentary call to discuss your student\'s needs and how I can help.', sort_order: 5 },
    { section_key: 'rate_2_title',label: 'Rate 2: Title',      content_type: 'text',     value: 'Tutoring Session', sort_order: 6 },
    { section_key: 'rate_2_price',label: 'Rate 2: Price',      content_type: 'text',     value: 'Contact for rates', sort_order: 7 },
    { section_key: 'rate_2_desc', label: 'Rate 2: Description',content_type: 'textarea', value: 'One-on-one academic tutoring tailored to your student\'s subject and grade level.', sort_order: 8 },
    { section_key: 'rate_3_title',label: 'Rate 3: Title',      content_type: 'text',     value: 'Consulting Package', sort_order: 9 },
    { section_key: 'rate_3_price',label: 'Rate 3: Price',      content_type: 'text',     value: 'Contact for rates', sort_order: 10 },
    { section_key: 'rate_3_desc', label: 'Rate 3: Description',content_type: 'textarea', value: 'A comprehensive educational consulting package including assessments, planning, and follow-up sessions.', sort_order: 11 },
  ]},
};

router.post('/api/pages', requireAuth, async (req, res, next) => {
  try {
    const { page_type, custom_title, custom_nav } = req.body;
    if (!PAGE_TEMPLATES[page_type]) return res.status(400).json({ ok: false, error: 'Invalid page type.' });

    const tmpl = PAGE_TEMPLATES[page_type];
    const title = (custom_title || tmpl.title).trim();
    const nav_label = (custom_nav || tmpl.nav_label).trim();
    const slug = page_type; // slug = page_type for simplicity

    const [[existing]] = await db.query('SELECT id FROM pages WHERE slug=?', [slug]);
    if (existing) return res.status(400).json({ ok: false, error: 'This page type already exists.' });

    const [[maxRow]] = await db.query('SELECT COALESCE(MAX(sort_order),0)+1 AS next FROM pages');
    await db.query(
      'INSERT INTO pages (slug, title, nav_label, page_type, is_active, show_in_nav, sort_order, is_builtin) VALUES (?,?,?,?,1,1,?,0)',
      [slug, title, nav_label, page_type, maxRow.next]
    );
    for (const c of tmpl.contentSeed) {
      await db.query(
        'INSERT IGNORE INTO content (page, section_key, label, content_type, value, sort_order) VALUES (?,?,?,?,?,?)',
        [slug, c.section_key, c.label, c.content_type, c.value, c.sort_order]
      );
    }
    res.json({ ok: true, slug });
  } catch (err) { next(err); }
});

router.post('/api/pages/:id/toggle', requireAuth, async (req, res, next) => {
  try {
    await db.query('UPDATE pages SET is_active = 1 - is_active WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/pages/:id/toggle-nav', requireAuth, async (req, res, next) => {
  try {
    await db.query('UPDATE pages SET show_in_nav = 1 - show_in_nav WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/pages/:id/delete', requireAuth, async (req, res, next) => {
  try {
    const [[page]] = await db.query('SELECT is_builtin FROM pages WHERE id=?', [req.params.id]);
    if (!page || page.is_builtin) return res.status(400).json({ ok: false, error: 'Built-in pages cannot be deleted.' });
    await db.query('DELETE FROM pages WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Social links ─────────────────────────────────────────────────────────────

router.post('/api/social', requireAuth, async (req, res, next) => {
  try {
    const { links } = req.body; // [{ platform, url, is_enabled }]
    if (!Array.isArray(links)) return res.status(400).json({ ok: false });
    for (const link of links) {
      await db.query('UPDATE social_links SET url=?, is_enabled=? WHERE platform=?',
        [(link.url || '').trim(), link.is_enabled ? 1 : 0, link.platform]);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Page item management (testimonials / faq / resources) ────────────────────

router.post('/api/testimonials', requireAuth, async (req, res, next) => {
  try {
    const { client_name, role, quote } = req.body;
    if (!client_name || !quote) return res.status(400).json({ ok: false, error: 'Name and quote are required.' });
    await db.query('INSERT INTO testimonials (client_name, role, quote, sort_order) VALUES (?,?,?,(SELECT COALESCE(MAX(t2.sort_order),0)+1 FROM testimonials t2))',
      [client_name.trim(), (role || '').trim(), quote.trim()]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/testimonials/:id/delete', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM testimonials WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/faq', requireAuth, async (req, res, next) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ ok: false, error: 'Question and answer are required.' });
    await db.query('INSERT INTO faq_items (question, answer, sort_order) VALUES (?,?,(SELECT COALESCE(MAX(f2.sort_order),0)+1 FROM faq_items f2))',
      [question.trim(), answer.trim()]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/faq/:id/delete', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM faq_items WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/resources', requireAuth, async (req, res, next) => {
  try {
    const { title, description, url } = req.body;
    if (!title) return res.status(400).json({ ok: false, error: 'Title is required.' });
    await db.query('INSERT INTO resources (title, description, url, sort_order) VALUES (?,?,?,(SELECT COALESCE(MAX(r2.sort_order),0)+1 FROM resources r2))',
      [title.trim(), (description || '').trim(), (url || '').trim()]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/resources/:id/delete', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM resources WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Content / photo / password ───────────────────────────────────────────────

router.post('/api/content', requireAuth, async (req, res, next) => {
  try {
    const { page, section_key, value } = req.body;
    if (!page || !section_key) return res.status(400).json({ ok: false });
    await db.query('UPDATE content SET value=? WHERE page=? AND section_key=?', [value, page, section_key]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/photo', requireAuth, upload.single('photo'), (req, res) => {
  res.json({ ok: true, path: '/images/photo.jpg?t=' + Date.now() });
});

router.post('/api/password', requireAuth, async (req, res, next) => {
  try {
    const { current, newpass, confirm } = req.body;
    if (newpass !== confirm) return res.json({ ok: false, error: 'New passwords do not match.' });
    if (newpass.length < 8) return res.json({ ok: false, error: 'Password must be at least 8 characters.' });
    const [[admin]] = await db.query('SELECT * FROM admins WHERE id=?', [req.session.adminId]);
    if (!(await bcrypt.compare(current, admin.password_hash)))
      return res.json({ ok: false, error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(newpass, 12);
    await db.query('UPDATE admins SET password_hash=? WHERE id=?', [hash, req.session.adminId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Messages ────────────────────────────────────────────────────────────────

router.get('/messages', requireAuth, async (req, res, next) => {
  try {
    const [contacts] = await db.query('SELECT * FROM contacts ORDER BY created_at DESC');
    const globals = await getAdminGlobals();
    res.render('admin/contacts', { contacts, ...globals });
  } catch (err) { next(err); }
});

router.post('/api/messages/:id/read', requireAuth, async (req, res, next) => {
  try {
    await db.query('UPDATE contacts SET is_read=1 WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/api/messages/:id/delete', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM contacts WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
