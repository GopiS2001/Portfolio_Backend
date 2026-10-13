// Copy everything from your local MySQL into a hosted database (TiDB Cloud).
//   npm run migrate-to-cloud -- --yes
//
// Source: BACKEND/.env (your local database). Target: BACKEND/.env.tidb.
//  - Creates the database and any missing tables on the target (same structure as local).
//  - Replaces the target's rows with your local rows (sign-in sessions are not copied).
//  - Copies uploaded files that still live in BACKEND/uploads into the database.
//  - Rewrites links to uploaded files from http://localhost:4000/uploads/… to PUBLIC_URL/uploads/….
// Safe to run again: each run overwrites the target with your current local content.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const CHUNK_SIZE = 2 * 1024 * 1024;
const SKIP_ROWS = new Set(['auth_sessions']);
const LOCAL_UPLOAD = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/uploads\//g;

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.pdf': 'application/pdf',
  '.apk': 'application/vnd.android.package-archive',
};

function readEnv(file) {
  const full = path.join(__dirname, '..', file);
  if (!fs.existsSync(full)) throw new Error(`${file} not found`);
  return dotenv.parse(fs.readFileSync(full));
}

const connect = (env, withDb = true) =>
  mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: withDb ? env.DB_NAME || 'portfolio' : undefined,
    ssl: env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    multipleStatements: false,
  });

(async () => {
  if (!process.argv.includes('--yes')) {
    console.error('This replaces the content in the TiDB database with your local content.\nRun: npm run migrate-to-cloud -- --yes');
    process.exit(1);
  }
  const source = readEnv('.env');
  // --target <file> lets you migrate somewhere else (default .env.tidb)
  const targetArg = process.argv.indexOf('--target');
  const target = readEnv(targetArg > -1 ? process.argv[targetArg + 1] : '.env.tidb');
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD']) {
    if (!target[key]) throw new Error(`Fill in ${key} in BACKEND/.env.tidb first`);
  }
  const publicUrl = (target.PUBLIC_URL || '').replace(/\/$/, '');
  if (!/^https:\/\//.test(publicUrl)) throw new Error('Set PUBLIC_URL in .env.tidb to your https Render address');
  const dbName = target.DB_NAME || 'portfolio';

  // 1. Database
  const admin = await connect(target, false);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  console.log(`✓ Connected to ${target.DB_HOST} — database "${dbName}" ready`);

  const src = await connect(source);
  const dst = await connect(target);

  const fix = (value) => {
    if (typeof value === 'string') return value.replace(LOCAL_UPLOAD, `${publicUrl}/uploads/`);
    if (value && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Date)) {
      return JSON.stringify(value).replace(LOCAL_UPLOAD, `${publicUrl}/uploads/`);
    }
    return value;
  };

  // 2. Tables + rows
  const [tables] = await src.query('SHOW TABLES');
  const names = tables.map((t) => Object.values(t)[0]);
  for (const table of names) {
    const [[create]] = await src.query(`SHOW CREATE TABLE \`${table}\``);
    await dst.query(create['Create Table'].replace(/^CREATE TABLE/, 'CREATE TABLE IF NOT EXISTS'));
    if (SKIP_ROWS.has(table)) {
      console.log(`  ${table}: structure only`);
      continue;
    }
    const [rows] = await src.query(`SELECT * FROM \`${table}\``);
    await dst.query(`DELETE FROM \`${table}\``);
    // Big blobs go one row per statement; everything else in batches of 100
    const batch = table === 'stored_file_chunks' ? 1 : 100;
    for (let i = 0; i < rows.length; i += batch) {
      const slice = rows.slice(i, i + batch);
      const cols = Object.keys(slice[0]);
      const sql = `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ?`;
      await dst.query(sql, [slice.map((r) => cols.map((c) => fix(r[c])))]);
    }
    console.log(`  ${table}: ${rows.length} row(s)`);
  }

  // 3. Files still on the local disk → database
  const uploadDir = path.join(__dirname, '..', 'uploads');
  const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).filter((f) => !f.startsWith('.')) : [];
  let copied = 0;
  for (const name of files) {
    const [[exists]] = await dst.query('SELECT COUNT(*) AS n FROM stored_files WHERE name = ?', [name]);
    if (exists.n) continue;
    const data = fs.readFileSync(path.join(uploadDir, name));
    let idx = 0;
    for (let offset = 0; offset < data.length || idx === 0; offset += CHUNK_SIZE) {
      await dst.query('INSERT INTO stored_file_chunks (fileName, idx, data) VALUES (?, ?, ?)', [
        name,
        idx++,
        data.subarray(offset, offset + CHUNK_SIZE),
      ]);
      if (data.length === 0) break;
    }
    await dst.query(
      'INSERT INTO stored_files (name, originalName, mimeType, size, chunkCount, createdAt) VALUES (?, ?, ?, ?, ?, NOW())',
      [name, name, MIME[path.extname(name).toLowerCase()] || 'application/octet-stream', data.length, idx],
    );
    copied++;
  }
  console.log(`  uploaded files: ${copied} copied from BACKEND/uploads (${files.length - copied} already there)`);

  await src.end();
  await dst.end();
  console.log(`\n✓ Done. Upload links now point to ${publicUrl}/uploads/…`);
})().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
