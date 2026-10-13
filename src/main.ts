import 'reflect-metadata';

import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config as loadEnv } from 'dotenv';
import { Connection, createConnection, RowDataPacket } from 'mysql2/promise';

import { AppModule } from './app.module';
import { createOriginPolicy } from './common/origins';
import { databaseSsl } from './common/database';

loadEnv();

/** TypeORM cannot create the database itself, so make sure it exists first. */
async function ensureDatabase() {
  const name = process.env.DB_NAME || 'portfolio';
  const conn = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: databaseSsl(),
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

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Behind a proxy (Render): trust X-Forwarded-* so req.ip is the visitor, not the proxy
  app.set('trust proxy', 1);

  // Allowed: any port on localhost, any private LAN address and every host in CORS_ORIGINS.
  // Credentials are on so browsers send the httpOnly refresh-token cookie to /api/auth.
  const origins = createOriginPolicy();
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || origins.isAllowed(origin)),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-App'],
  });
  // File links stay at /uploads/<name> (served from the database), everything else under /api
  app.setGlobalPrefix('api', { exclude: [{ path: 'uploads/:name', method: RequestMethod.GET }] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API ready on port ${port} — http://localhost:${port}/api`, 'Bootstrap');
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
