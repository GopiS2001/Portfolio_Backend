// Reset the dashboard admin password when you're locked out.
//   npm run reset-password -- <new-password> [email]
// Email defaults to ADMIN_EMAIL from .env.
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

(async () => {
  const [password, emailArg] = process.argv.slice(2);
  const email = (emailArg || process.env.ADMIN_EMAIL || 'admin@portfolio.com').toLowerCase();
  if (!password || password.length < 6) {
    console.error('Usage: npm run reset-password -- <new-password (6+ chars)> [email]');
    process.exit(1);
  }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'portfolio',
  });
  const [result] = await db.query('UPDATE users SET passwordHash = ? WHERE email = ?', [
    await bcrypt.hash(password, 10),
    email,
  ]);
  await db.end();

  if (result.affectedRows) console.log(`Password updated for ${email}`);
  else {
    console.error(`No admin user with email ${email}`);
    process.exit(1);
  }
})();
