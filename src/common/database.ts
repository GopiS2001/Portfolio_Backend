/**
 * Database connection settings shared by TypeORM, the start-up check in main.ts and the scripts.
 * DB_SSL=true turns on TLS (required by TiDB Cloud and most hosted MySQL services); the server
 * certificate is verified against the system's trusted CAs.
 */
export function databaseSsl() {
  return process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined;
}

/** Public base URL of this API, used to build links to uploaded files. */
export function publicBaseUrl() {
  const url =
    process.env.PUBLIC_URL ||
    // Render sets this automatically (e.g. https://gopi-portfolio-api.onrender.com)
    process.env.RENDER_EXTERNAL_URL ||
    `http://localhost:${process.env.PORT || 4000}`;
  return url.replace(/\/$/, '');
}
