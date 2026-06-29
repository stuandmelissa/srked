import express from 'express';
import db from '../db.js';
import nodemailer from 'nodemailer';

const router = express.Router();

async function getContent(page) {
  const [rows] = await db.query(
    'SELECT section_key, value FROM content WHERE page = ? ORDER BY sort_order',
    [page]
  );
  const content = {};
  rows.forEach(r => { content[r.section_key] = r.value || ''; });
  return content;
}

async function sendContactEmail(contact) {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
  await transporter.sendMail({
    from: `"SRK Consulting Website" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO || 'info@srked.com',
    subject: `New message from ${contact.name} — SRK Consulting`,
    text: `Name: ${contact.name}\nEmail: ${contact.email}\nPhone: ${contact.phone || 'N/A'}\n\nMessage:\n${contact.message}`,
    html: `
      <h2 style="color:#1B3A6B;">New Contact Form Submission</h2>
      <table style="border-collapse:collapse;width:100%;max-width:500px;">
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Name</td><td style="padding:8px;">${contact.name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Email</td><td style="padding:8px;"><a href="mailto:${contact.email}">${contact.email}</a></td></tr>
        <tr><td style="padding:8px;font-weight:bold;color:#555;">Phone</td><td style="padding:8px;">${contact.phone || 'N/A'}</td></tr>
      </table>
      <h3 style="color:#1B3A6B;margin-top:20px;">Message</h3>
      <p style="white-space:pre-wrap;background:#f8f9fa;padding:15px;border-radius:6px;">${contact.message}</p>
    `
  });
}

router.get('/', async (req, res) => {
  const content = await getContent('home');
  const servicesContent = await getContent('services');
  res.render('index', { title: 'SRK Consulting', page: 'home', content, servicesContent });
});

router.get('/about', async (req, res) => {
  const content = await getContent('about');
  res.render('about', { title: 'About — SRK Consulting', page: 'about', content });
});

router.get('/services', async (req, res) => {
  const content = await getContent('services');
  res.render('services', { title: 'Services — SRK Consulting', page: 'services', content });
});

router.get('/contact', async (req, res) => {
  const content = await getContent('contact');
  res.render('contact', { title: 'Contact — SRK Consulting', page: 'contact', content, error: null });
});

router.post('/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;

  if (!name || !email || !message) {
    const content = await getContent('contact');
    return res.render('contact', {
      title: 'Contact — SRK Consulting', page: 'contact', content,
      error: 'Please fill in your name, email, and message.'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const content = await getContent('contact');
    return res.render('contact', {
      title: 'Contact — SRK Consulting', page: 'contact', content,
      error: 'Please enter a valid email address.'
    });
  }

  await db.query(
    'INSERT INTO contacts (name, email, phone, message) VALUES (?, ?, ?, ?)',
    [name.trim(), email.trim(), phone ? phone.trim() : null, message.trim()]
  );

  try {
    await sendContactEmail({ name: name.trim(), email: email.trim(), phone: phone?.trim(), message: message.trim() });
  } catch (err) {
    console.error('Email send failed:', err.message);
  }

  res.redirect('/contact/success');
});

router.get('/contact/success', (req, res) => {
  res.render('contact-success', { title: 'Message Sent — SRK Consulting', page: 'contact' });
});

export default router;
