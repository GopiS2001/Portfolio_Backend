/**
 * Which browser origins may call the API with credentials (the refresh-token cookie).
 * Allowed: any port on localhost, any private LAN address (your Wi-Fi IP changes),
 * and every host listed in CORS_ORIGINS (e.g. your real domains in production).
 */
export function createOriginPolicy(corsOrigins = process.env.CORS_ORIGINS || '*') {
  const origins = corsOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  const hosts = new Set(['localhost', '127.0.0.1']);
  for (const o of origins) {
    try {
      hosts.add(new URL(o).hostname);
    } catch {}
  }
  const isPrivateIp = (h: string) =>
    /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);

  /** Trusted for cookie-based auth (never the `*` wildcard). */
  const isTrusted = (origin: string) => {
    try {
      const host = new URL(origin).hostname;
      return hosts.has(host) || isPrivateIp(host);
    } catch {
      return false;
    }
  };

  /** Allowed by CORS at all (public endpoints honour `*`). */
  const isAllowed = (origin: string) => origins.includes('*') || isTrusted(origin);

  return { isTrusted, isAllowed };
}
