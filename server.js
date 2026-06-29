import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from './db.js';
import adminRouter from './routes/admin.js';
import publicRouter from './routes/public.js';

if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET env var is required');

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Admin router must be mounted before public router so /:slug doesn't shadow /admin/*
app.use('/admin', adminRouter);
app.use('/', publicRouter);

app.use(async (req, res) => {
  try {
    const [navPages] = await db.query('SELECT slug, nav_label, page_type FROM pages WHERE show_in_nav=1 AND is_active=1 ORDER BY sort_order');
    res.status(404).render('404', { title: 'Page Not Found', page: '', navPages, services: [], socialLinks: [] });
  } catch { res.status(404).send('Page not found'); }
});

// Global error handler — never expose stack traces to the browser
app.use(async (err, req, res, _next) => {
  console.error(err.stack);
  try {
    const [navPages] = await db.query('SELECT slug, nav_label, page_type FROM pages WHERE show_in_nav=1 AND is_active=1 ORDER BY sort_order');
    res.status(500).render('404', { title: 'Something went wrong', page: '', navPages, services: [], socialLinks: [] });
  } catch { res.status(500).send('Something went wrong'); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SRK Consulting running at http://localhost:${PORT}`));
