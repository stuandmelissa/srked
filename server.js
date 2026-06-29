import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import publicRouter from './routes/public.js';
import adminRouter from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'srk-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use('/', publicRouter);
app.use('/admin', adminRouter);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SRK Consulting running at http://localhost:${PORT}`);
});
