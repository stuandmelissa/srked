import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const DB_NAME = process.env.DB_NAME || 'srk_consulting';

const contentSeed = [
  // Home
  { page: 'home', section_key: 'hero_title',     label: 'Hero Title',           content_type: 'text',     value: 'Empowering Every Student to Succeed',                                                                                                                                                              sort_order: 1 },
  { page: 'home', section_key: 'hero_subtitle',  label: 'Hero Subtitle',        content_type: 'textarea', value: 'Educational consulting and personalized tutoring designed to help your child discover their strengths, overcome challenges, and reach their full potential.',                                       sort_order: 2 },
  { page: 'home', section_key: 'hero_cta',       label: 'Hero Button Text',     content_type: 'text',     value: 'Schedule a Free Consultation',                                                                                                                                                                     sort_order: 3 },
  { page: 'home', section_key: 'intro_title',    label: 'Introduction Title',   content_type: 'text',     value: 'Welcome to SRK Consulting',                                                                                                                                                                        sort_order: 4 },
  { page: 'home', section_key: 'intro_text',     label: 'Introduction Text',    content_type: 'textarea', value: 'I believe every student has unique strengths and the ability to succeed. Whether your child needs extra academic support, guidance navigating educational decisions, or help planning for the future — I am here to walk alongside your family every step of the way.',  sort_order: 5 },
  // About
  { page: 'about', section_key: 'page_title',         label: 'Page Title',              content_type: 'text',     value: 'About Stacy',                                                                                                                                                                                                                                         sort_order: 1 },
  { page: 'about', section_key: 'bio_heading',         label: 'Bio Heading',             content_type: 'text',     value: 'Meet Stacy',                                                                                                                                                                                                                                          sort_order: 2 },
  { page: 'about', section_key: 'bio_text',            label: 'Bio / About Text',        content_type: 'textarea', value: 'With a deep passion for education and a commitment to student success, I founded SRK Consulting to provide families with the personalized support they deserve.\n\nI have worked with students of all ages and learning styles, helping them navigate academic challenges, identify their strengths, and build the confidence they need to thrive. My approach is always collaborative — I work closely with students and their families to create customized plans that meet their unique needs.\n\nWhether you are looking for tutoring in a specific subject, guidance on educational decisions, or support through a challenging transition, I am here to help.',  sort_order: 3 },
  { page: 'about', section_key: 'credentials_heading', label: 'Credentials Heading',     content_type: 'text',     value: 'Education & Experience',                                                                                                                                                                                                                             sort_order: 4 },
  { page: 'about', section_key: 'credentials_text',    label: 'Credentials / Experience',content_type: 'textarea', value: "Bachelor's Degree in Education\nYears of experience in educational consulting and tutoring\nSpecialized training in learning differences and student support\nMember of professional educational organizations",                                        sort_order: 5 },
  // Services
  { page: 'services', section_key: 'page_title',      label: 'Page Title',              content_type: 'text',     value: 'Services',                                                                                                                                                                                                                                             sort_order: 1 },
  { page: 'services', section_key: 'intro_text',      label: 'Introduction Text',       content_type: 'textarea', value: "I offer a range of services tailored to meet your student's unique needs. Every plan is customized — because every student is different.",                                                                                                              sort_order: 2 },
  { page: 'services', section_key: 'service_1_title', label: 'Service 1: Title',        content_type: 'text',     value: 'Educational Consulting',                                                                                                                                                                                                                               sort_order: 3 },
  { page: 'services', section_key: 'service_1_text',  label: 'Service 1: Description',  content_type: 'textarea', value: 'Navigating educational options can be overwhelming. I help families understand their choices, interpret evaluations, advocate within school systems, and create action plans that set students up for success.',                                         sort_order: 4 },
  { page: 'services', section_key: 'service_2_title', label: 'Service 2: Title',        content_type: 'text',     value: 'Academic Tutoring',                                                                                                                                                                                                                                    sort_order: 5 },
  { page: 'services', section_key: 'service_2_text',  label: 'Service 2: Description',  content_type: 'textarea', value: "One-on-one tutoring sessions in core subjects, tailored to your student's learning style. I work with students from elementary through high school on reading, writing, math, and more.",                                                              sort_order: 6 },
  { page: 'services', section_key: 'service_3_title', label: 'Service 3: Title',        content_type: 'text',     value: 'College Planning',                                                                                                                                                                                                                                     sort_order: 7 },
  { page: 'services', section_key: 'service_3_text',  label: 'Service 3: Description',  content_type: 'textarea', value: 'From selecting the right courses in high school to crafting a compelling college application, I guide students and families through every step of the college planning process.',                                                                       sort_order: 8 },
  { page: 'services', section_key: 'service_4_title', label: 'Service 4: Title',        content_type: 'text',     value: 'Learning Strategy Coaching',                                                                                                                                                                                                                          sort_order: 9 },
  { page: 'services', section_key: 'service_4_text',  label: 'Service 4: Description',  content_type: 'textarea', value: 'Teaching students the organizational skills, study strategies, and growth mindset they need to become confident, independent learners — skills that will serve them for life.',                                                                         sort_order: 10 },
  // Contact
  { page: 'contact', section_key: 'page_title',  label: 'Page Title',        content_type: 'text',     value: 'Get in Touch',                                                                                                                                                                           sort_order: 1 },
  { page: 'contact', section_key: 'intro_text',  label: 'Introduction Text', content_type: 'textarea', value: "I'd love to hear from you. Fill out the form below and I'll get back to you within 24 hours.",                                                                                           sort_order: 2 },
];

async function setup() {
  console.log('Setting up SRK Consulting database...\n');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await conn.query(`USE \`${DB_NAME}\``);
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
  console.log('✓ Table: content');

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
  console.log('✓ Table: contacts');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ Table: admins');

  for (const row of contentSeed) {
    await conn.query(
      `INSERT IGNORE INTO content (page, section_key, label, content_type, value, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.page, row.section_key, row.label, row.content_type, row.value, row.sort_order]
    );
  }
  console.log(`✓ Seeded ${contentSeed.length} content items`);

  const [existing] = await conn.query('SELECT id FROM admins LIMIT 1');
  if (existing.length === 0) {
    const defaultPassword = 'SRKadmin2024';
    const hash = await bcrypt.hash(defaultPassword, 12);
    await conn.query('INSERT INTO admins (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    console.log('\n✓ Admin account created');
    console.log('  Username: admin');
    console.log(`  Password: ${defaultPassword}`);
    console.log('  ⚠️  Please change the password at /admin after first login!\n');
  } else {
    console.log('✓ Admin account already exists');
  }

  await conn.end();
  console.log('\nSetup complete! Run "npm run dev" to start the server.');
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
