import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config as loadEnv } from 'dotenv';
import { mkdirSync } from 'fs';
import { Connection, createConnection, RowDataPacket } from 'mysql2/promise';

import { AppModule } from './app.module';
import { UPLOAD_DIR } from './uploads/uploads.controller';

loadEnv();

/** TypeORM cannot create the database itself, so make sure it exists first. */
async function ensureDatabase() {
  const name = process.env.DB_NAME || 'portfolio';
  const conn = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${name.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await conn.changeUser({ database: name });
  await migrateExperiencePoints(conn);
  await conn.end();
}

/**
 * Experience "achievements" (points: string[]) became "project explanation" (description: text).
 * Copy existing points into the new column before TypeORM sync drops the old one.
 */
async function migrateExperiencePoints(conn: Connection) {
  const [cols] = await conn.query<RowDataPacket[]>(
    "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'experiences'",
  );
  const names = cols.map((c) => c.name);
  if (!names.includes('points')) return;
  if (!names.includes('description')) {
    await conn.query('ALTER TABLE `experiences` ADD `description` text NULL');
  }
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT id, points FROM `experiences` WHERE description IS NULL OR description = ""',
  );
  for (const row of rows) {
    const points: string[] = typeof row.points === 'string' ? JSON.parse(row.points) : (row.points ?? []);
    const text = points.join(' ');
    if (text) await conn.query('UPDATE `experiences` SET description = ? WHERE id = ?', [text, row.id]);
  }
  Logger.log(`Moved achievements into project explanations for ${rows.length} experience(s)`, 'Migration');
}

async function bootstrap() {
  await ensureDatabase();
  mkdirSync(UPLOAD_DIR, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Allowed: any port on localhost, on any private LAN address (your Wi-Fi IP changes),
  // and on every host listed in CORS_ORIGINS (e.g. your real domain in production).
  const origins = (process.env.CORS_ORIGINS || '*').split(',').map((o) => o.trim());
  const hosts = new Set(['localhost', '127.0.0.1']);
  for (const o of origins) {
    try {
      hosts.add(new URL(o).hostname);
    } catch {}
  }
  const isPrivateIp = (h: string) =>
    /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origins.includes('*')) return callback(null, true);
      try {
        const host = new URL(origin).hostname;
        callback(null, hosts.has(host) || isPrivateIp(host));
      } catch {
        callback(null, false);
      }
    },
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(UPLOAD_DIR, {
    prefix: '/uploads',
    // Phones only offer to install an APK when it arrives with this type, as a download.
    setHeaders: (res, path) => {
      if (path.toLowerCase().endsWith('.apk')) {
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API ready on http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap().catch((err) => {
  if (err?.code === 'ER_ACCESS_DENIED_ERROR' || err?.code === 'ECONNREFUSED') {
    Logger.error(
      `Cannot connect to MySQL (${err.code}). Check DB_HOST / DB_USER / DB_PASSWORD in BACKEND/.env and that the MySQL service is running.`,
      undefined,
      'Bootstrap',
    );
  } else {
    Logger.error(err?.stack ?? err, undefined, 'Bootstrap');
  }
  process.exit(1);
});
