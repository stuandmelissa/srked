import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

app.use((req, res) => res.status(404).render('404', { title: 'Page Not Found' }));

// Global error handler — never expose stack traces to the browser
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).render('404', { title: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SRK Consulting running at http://localhost:${PORT}`));
