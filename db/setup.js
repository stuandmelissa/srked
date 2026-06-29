import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const DB_NAME = process.env.DB_NAME || 'srk_consulting';

const contentSeed = [
  { page: 'home', section_key: 'hero_title',     label: 'Hero Title',           content_type: 'text',     value: 'Empowering Every Student to Succeed',                                                                                                                                                              sort_order: 1 },
  { page: 'home', section_key: 'hero_subtitle',  label: 'Hero Subtitle',        content_type: 'textarea', value: 'Educational consulting and personalized tutoring designed to help your child discover their strengths, overcome challenges, and reach their full potential.',                                       sort_order: 2 },
  { page: 'home', section_key: 'hero_cta',       label: 'Hero Button Text',     content_type: 'text',     value: 'Schedule a Free Consultation',                                                                                                                                                                     sort_order: 3 },
  { page: 'home', section_key: 'intro_title',    label: 'Introduction Title',   content_type: 'text',     value: 'Welcome to SRK Consulting',                                                                                                                                                                        sort_order: 4 },
  { page: 'home', section_key: 'intro_text',     label: 'Introduction Text',    content_type: 'textarea', value: 'I believe every student has unique strengths and the ability to succeed. Whether your child needs extra academic support, guidance navigating educational decisions, or help planning for the future — I am here to walk alongside your family every step of the way.',  sort_order: 5 },
  { page: 'about', section_key: 'page_title',         label: 'Page Title',               content_type: 'text',     value: 'About Stacy',  sort_order: 1 },
  { page: 'about', section_key: 'bio_heading',        label: 'Bio Heading',              content_type: 'text',     value: 'Meet Stacy',   sort_order: 2 },
  { page: 'about', section_key: 'bio_text',           label: 'Bio / About Text',         content_type: 'textarea', value: 'With a deep passion for education and a commitment to student success, I founded SRK Consulting to provide families with the personalized support they deserve.\n\nI have worked with students of all ages and learning styles, helping them navigate academic challenges, identify their strengths, and build the confidence they need to thrive. My approach is always collaborative — I work closely with students and their families to create customized plans that meet their unique needs.\n\nWhether you are looking for tutoring in a specific subject, guidance on educational decisions, or support through a challenging transition, I am here to help.', sort_order: 3 },
  { page: 'about', section_key: 'credentials_heading', label: 'Credentials Heading',    content_type: 'text',     value: 'Education & Experience', sort_order: 4 },
  { page: 'about', section_key: 'credentials_text',    label: 'Credentials / Experience',content_type: 'textarea', value: "Bachelor's Degree in Education\nYears of experience in educational consulting and tutoring\nSpecialized training in learning differences and student support\nMember of professional educational organizations", sort_order: 5 },
  { page: 'services', section_key: 'page_title', label: 'Page Title',         content_type: 'text',     value: 'Services', sort_order: 1 },
  { page: 'services', section_key: 'intro_text', label: 'Introduction Text',  content_type: 'textarea', value: "I offer a range of services tailored to meet your student's unique needs. Every plan is customized — because every student is different.", sort_order: 2 },
  { page: 'contact', section_key: 'page_title',  label: 'Page Title',        content_type: 'text',     value: 'Get in Touch', sort_order: 1 },
  { page: 'contact', section_key: 'intro_text',  label: 'Introduction Text', content_type: 'textarea', value: "I'd love to hear from you. Fill out the form below and I'll get back to you within 24 hours.", sort_order: 2 },
];

const servicesSeed = [
  { title: 'Educational Consulting',    description: 'Navigating educational options can be overwhelming. I help families understand their choices, interpret evaluations, advocate within school systems, and create action plans that set students up for success.',                                                                    icon: 'compass',         sort_order: 1 },
  { title: 'Academic Tutoring',         description: "One-on-one tutoring sessions in core subjects, tailored to your student's learning style. I work with students from elementary through high school on reading, writing, math, and more.",                                                                                     icon: 'pencil-line',     sort_order: 2 },
  { title: 'College Planning',          description: 'From selecting the right courses in high school to crafting a compelling college application, I guide students and families through every step of the college planning process.',                                                                                                icon: 'graduation-cap',  sort_order: 3 },
  { title: 'Learning Strategy Coaching',description: 'Teaching students the organizational skills, study strategies, and growth mindset they need to become confident, independent learners — skills that will serve them for life.',                                                                                                 icon: 'lightbulb',       sort_order: 4 },
];

const pagesSeed = [
  { slug: 'home',     title: 'Home',    nav_label: 'Home',    page_type: 'home',    is_active: 1, show_in_nav: 1, sort_order: 1, is_builtin: 1 },
  { slug: 'about',    title: 'About',   nav_label: 'About',   page_type: 'about',   is_active: 1, show_in_nav: 1, sort_order: 2, is_builtin: 1 },
  { slug: 'services', title: 'Services',nav_label: 'Services',page_type: 'services',is_active: 1, show_in_nav: 1, sort_order: 3, is_builtin: 1 },
  { slug: 'contact',  title: 'Contact', nav_label: 'Contact', page_type: 'contact', is_active: 1, show_in_nav: 1, sort_order: 4, is_builtin: 1 },
];

const socialSeed = [
  { platform: 'instagram', label: 'Instagram', sort_order: 1 },
  { platform: 'facebook',  label: 'Facebook',  sort_order: 2 },
  { platform: 'linkedin',  label: 'LinkedIn',  sort_order: 3 },
  { platform: 'twitter',   label: 'X / Twitter', sort_order: 4 },
  { platform: 'youtube',   label: 'YouTube',   sort_order: 5 },
  { platform: 'pinterest', label: 'Pinterest', sort_order: 6 },
];

async function setup() {
  console.log('Setting up SRK Consulting database...\n');

  try {
    const tmp = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });
    await tmp.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await tmp.end();
  } catch { /* database already exists or no CREATE privilege — fine */ }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
  });

  console.log(`✓ Database "${DB_NAME}" ready`);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS content (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page VARCHAR(50) NOT NULL,
      section_key VARCHAR(100) NOT NULL,
      label VARCHAR(200) NOT NULL,
      content_type ENUM('text','textarea') DEFAULT 'text',
      value TEXT,
      sort_order INT DEFAULT 0,
      UNIQUE KEY uq_page_key (page, section_key)
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(200) NOT NULL,
      phone VARCHAR(50),
      message TEXT NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(50) DEFAULT 'pencil-line',
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS pages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(100) NOT NULL UNIQUE,
      title VARCHAR(200) NOT NULL,
      nav_label VARCHAR(100) NOT NULL,
      page_type VARCHAR(50) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      show_in_nav TINYINT(1) DEFAULT 1,
      sort_order INT DEFAULT 0,
      is_builtin TINYINT(1) DEFAULT 0
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS social_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      platform VARCHAR(50) NOT NULL UNIQUE,
      label VARCHAR(100) NOT NULL,
      url VARCHAR(500) DEFAULT '',
      is_enabled TINYINT(1) DEFAULT 0,
      sort_order INT DEFAULT 0
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_name VARCHAR(200) NOT NULL,
      role VARCHAR(200) DEFAULT '',
      quote TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS faq_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      question VARCHAR(500) NOT NULL,
      answer TEXT NOT NULL,
      sort_order INT DEFAULT 0
    )
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS resources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description VARCHAR(500) DEFAULT '',
      url VARCHAR(500) DEFAULT '',
      sort_order INT DEFAULT 0
    )
  `);

  // Ensure unique constraint on services.title (idempotent)
  try {
    await conn.query(`CREATE UNIQUE INDEX services_title_uq ON services (title)`);
  } catch { /* already exists */ }

  console.log('✓ Tables ready');

  for (const row of contentSeed) {
    await conn.query(
      `INSERT IGNORE INTO content (page, section_key, label, content_type, value, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.page, row.section_key, row.label, row.content_type, row.value, row.sort_order]
    );
  }

  for (const s of servicesSeed) {
    await conn.query(
      `INSERT IGNORE INTO services (title, description, icon, sort_order) VALUES (?, ?, ?, ?)`,
      [s.title, s.description, s.icon, s.sort_order]
    );
  }

  for (const p of pagesSeed) {
    await conn.query(
      `INSERT IGNORE INTO pages (slug, title, nav_label, page_type, is_active, show_in_nav, sort_order, is_builtin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.slug, p.title, p.nav_label, p.page_type, p.is_active, p.show_in_nav, p.sort_order, p.is_builtin]
    );
  }

  for (const s of socialSeed) {
    await conn.query(
      `INSERT IGNORE INTO social_links (platform, label, url, is_enabled, sort_order) VALUES (?, ?, '', 0, ?)`,
      [s.platform, s.label, s.sort_order]
    );
  }

  // Migrate any leftover emoji icons to lucide names
  const emojiMap = [
    ['compass',        'Educational Consulting'],
    ['pencil-line',    'Academic Tutoring'],
    ['graduation-cap', 'College Planning'],
    ['lightbulb',      'Learning Strategy Coaching'],
  ];
  for (const [icon, title] of emojiMap) {
    await conn.query(
      `UPDATE services SET icon=? WHERE title=? AND icon NOT REGEXP '^[a-z][a-z0-9-]+$'`,
      [icon, title]
    );
  }

  console.log('✓ Seeded default data');

  const [existing] = await conn.query('SELECT id FROM admins LIMIT 1');
  if (existing.length === 0) {
    const defaultPassword = 'SRKadmin2024';
    const hash = await bcrypt.hash(defaultPassword, 12);
    await conn.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    console.log('\n✓ Admin account created — username: admin  password: SRKadmin2024');
    console.log('  ⚠️  Change the password at /admin after first login!\n');
  } else {
    console.log('✓ Admin account exists');
  }

  await conn.end();
  console.log('\nSetup complete! Run "npm run dev" to start the server.');
}

setup().catch(err => { console.error('Setup failed:', err.message); process.exit(1); });
