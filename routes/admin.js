const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

// Multer config for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/images')),
  filename: (req, file, cb) => cb(null, 'photo.jpg')
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) return next();
  res.redirect('/admin/login');
}

async function getContent(page) {
  const [rows] = await db.query(
    'SELECT id, section_key, label, content_type, value FROM content WHERE page = ? ORDER BY sort_order',
    [page]
  );
  return rows;
}

async function getUnreadCount() {
  const [[row]] = await db.query('SELECT COUNT(*) AS cnt FROM contacts WHERE is_read = 0');
  return row.cnt;
}

// ─── Login ───────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const [[admin]] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.render('admin/login', { error: 'Incorrect username or password.' });
  }
  req.session.adminId = admin.id;
  res.redirect('/admin');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ─── Dashboard root ───────────────────────────────────────────────────────────

router.get('/', requireAuth, (req, res) => res.redirect('/admin/page/home'));

// ─── Content editing ─────────────────────────────────────────────────────────

const PAGES = ['home', 'about', 'services', 'contact'];
const ALL_PAGES = [...PAGES, 'settings'];

router.get('/settings', requireAuth, async (req, res) => {
  const unreadCount = await getUnreadCount();
  res.render('admin/dashboard', {
    pageName: 'settings',
    fields: [],
    pages: PAGES,
    unreadCount,
    saved: null
  });
});

router.get('/page/:pageName', requireAuth, async (req, res) => {
  const { pageName } = req.params;
  if (!PAGES.includes(pageName)) return res.redirect('/admin/page/home');

  const fields = await getContent(pageName);
  const unreadCount = await getUnreadCount();
  res.render('admin/dashboard', {
    pageName,
    fields,
    pages: PAGES,
    unreadCount,
    saved: req.query.saved || null
  });
});

// AJAX save for a single content field
router.post('/api/content', requireAuth, async (req, res) => {
  const { page, section_key, value } = req.body;
  if (!page || !section_key) return res.status(400).json({ ok: false });
  await db.query(
    'UPDATE content SET value = ? WHERE page = ? AND section_key = ?',
    [value, page, section_key]
  );
  res.json({ ok: true });
});

// Photo upload
router.post('/api/photo', requireAuth, upload.single('photo'), (req, res) => {
  res.json({ ok: true, path: '/images/photo.jpg?t=' + Date.now() });
});

// Change password
router.post('/api/password', requireAuth, async (req, res) => {
  const { current, newpass, confirm } = req.body;
  if (newpass !== confirm) return res.json({ ok: false, error: 'New passwords do not match.' });
  if (newpass.length < 8) return res.json({ ok: false, error: 'Password must be at least 8 characters.' });

  const [[admin]] = await db.query('SELECT * FROM admins WHERE id = ?', [req.session.adminId]);
  if (!(await bcrypt.compare(current, admin.password_hash))) {
    return res.json({ ok: false, error: 'Current password is incorrect.' });
  }
  const hash = await bcrypt.hash(newpass, 12);
  await db.query('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, req.session.adminId]);
  res.json({ ok: true });
});

// ─── Messages ────────────────────────────────────────────────────────────────

router.get('/messages', requireAuth, async (req, res) => {
  const [contacts] = await db.query('SELECT * FROM contacts ORDER BY created_at DESC');
  const unreadCount = await getUnreadCount();
  res.render('admin/contacts', { contacts, unreadCount, pages: PAGES });
});

router.post('/api/messages/:id/read', requireAuth, async (req, res) => {
  await db.query('UPDATE contacts SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.post('/api/messages/:id/delete', requireAuth, async (req, res) => {
  await db.query('DELETE FROM contacts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
