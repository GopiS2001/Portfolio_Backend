import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { IsNull, LessThan, MoreThan, Not, Repository } from 'typeorm';

import { AuthSession, SessionClient } from './session.entity';
import { User } from './user.entity';

export type AccessPayload = { sub: number; email: string; role: string; sid: string };

export type ClientInfo = { client: SessionClient; userAgent?: string; ip?: string };

export type IssuedTokens = {
  accessToken: string;
  /** Epoch ms — clients refresh a little before this. */
  accessTokenExpiresAt: number;
  /** Null when a refresh fell in the rotation grace window (the client already holds the newer token). */
  refreshToken: string | null;
  refreshTokenExpiresAt: number;
  user: User;
};

/** Machine-readable reason sent with 401s so clients know whether to refresh or sign out. */
export const AUTH_ERROR = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  sessionExpired: 'SESSION_EXPIRED',
  sessionRevoked: 'SESSION_REVOKED',
  accessTokenExpired: 'ACCESS_TOKEN_EXPIRED',
  accessTokenInvalid: 'ACCESS_TOKEN_INVALID',
} as const;

export const unauthorized = (code: string, message: string) =>
  new UnauthorizedException({ statusCode: 401, error: 'Unauthorized', code, message });

/** Two tabs refreshing with the same cookie within this window both succeed. */
const ROTATION_GRACE_MS = 30_000;

const MAX_FAILED_SIGN_INS = 5;
const SIGN_IN_WINDOW_MS = 15 * 60_000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const sameHash = (a: string, b: string | null) =>
  !!b && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlMs: number;
  private readonly failedSignIns = new Map<string, { count: number; first: number }>();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthSession) private readonly sessions: Repository<AuthSession>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.refreshTtlMs = Number(config.get('REFRESH_TOKEN_TTL_DAYS', 7)) * 86_400_000;
  }

  /** Creates the first admin from .env when the users table is empty. */
  async onModuleInit() {
    if (this.config.get('JWT_SECRET', 'change-me').startsWith('change-me')) {
      this.logger.warn('JWT_SECRET is not set — set a long random value in BACKEND/.env before going live.');
    }
    // Housekeeping: forget sessions that ended more than a week ago
    await this.sessions.delete({ expiresAt: LessThan(new Date(Date.now() - 7 * 86_400_000)) });

    if (await this.users.count()) return;
    const email = this.config.get('ADMIN_EMAIL', 'admin@portfolio.com').toLowerCase();
    const password = this.config.get('ADMIN_PASSWORD', 'admin123');
    await this.users.save(
      this.users.create({
        email,
        displayName: this.config.get('ADMIN_NAME', 'Admin'),
        passwordHash: await bcrypt.hash(password, 10),
      }),
    );
    this.logger.log(`Created admin account ${email}`);
  }

  // ---------------------------------------------------------------- sign in / refresh / sign out

  async signIn(email: string, password: string, info: ClientInfo): Promise<IssuedTokens> {
    const key = `${info.ip ?? ''}|${email.toLowerCase()}`;
    this.assertNotLockedOut(key);

    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: email.toLowerCase() })
      .getOne();
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      this.recordFailure(key);
      throw unauthorized(AUTH_ERROR.invalidCredentials, 'Invalid email or password');
    }
    this.failedSignIns.delete(key);

    const secret = randomBytes(32).toString('base64url');
    const now = new Date();
    const session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: sha256(secret),
        previousHash: null,
        rotatedAt: null,
        expiresAt: new Date(now.getTime() + this.refreshTtlMs),
        revokedAt: null,
        revokedReason: null,
        client: info.client,
        userAgent: (info.userAgent ?? '').slice(0, 255),
        ip: (info.ip ?? '').slice(0, 64),
        lastUsedAt: now,
      }),
    );
    // Don't send the password hash back
    const { passwordHash: _, ...safeUser } = user;
    return this.issue(safeUser as User, session, secret);
  }

  /** Exchanges a refresh token for a new access token and rotates the refresh token. */
  async refresh(refreshToken: string | undefined, info: Partial<ClientInfo>): Promise<IssuedTokens> {
    const { id, secret } = this.parseRefreshToken(refreshToken);
    const session = await this.sessions.findOneBy({ id });
    if (!session) throw unauthorized(AUTH_ERROR.sessionRevoked, 'Session not found — please sign in again');
    if (session.revokedAt) throw unauthorized(AUTH_ERROR.sessionRevoked, 'This session was signed out');
    if (session.expiresAt.getTime() <= Date.now()) {
      throw unauthorized(AUTH_ERROR.sessionExpired, 'Your session expired — please sign in again');
    }

    const user = await this.users.findOneBy({ id: session.userId });
    if (!user) {
      await this.revoke(session, 'user-deleted');
      throw unauthorized(AUTH_ERROR.sessionRevoked, 'Account no longer exists');
    }

    const presented = sha256(secret);
    const now = new Date();

    if (sameHash(presented, session.tokenHash)) {
      const next = randomBytes(32).toString('base64url');
      session.previousHash = session.tokenHash;
      session.tokenHash = sha256(next);
      session.rotatedAt = now;
      session.expiresAt = new Date(now.getTime() + this.refreshTtlMs);
      session.lastUsedAt = now;
      if (info.ip) session.ip = info.ip.slice(0, 64);
      await this.sessions.save(session);
      return this.issue(user, session, next);
    }

    // Another tab refreshed a moment ago with the same token: allow it, but don't rotate again
    if (
      sameHash(presented, session.previousHash) &&
      session.rotatedAt &&
      now.getTime() - session.rotatedAt.getTime() < ROTATION_GRACE_MS
    ) {
      session.lastUsedAt = now;
      await this.sessions.save(session);
      return this.issue(user, session, null);
    }

    // An old refresh token was replayed — treat it as stolen and end the session
    await this.revoke(session, 'token-reuse');
    this.logger.warn(`Refresh token reuse detected — session ${session.id} revoked`);
    throw unauthorized(AUTH_ERROR.sessionRevoked, 'Session revoked for your security — please sign in again');
  }

  /** Revokes the session a refresh token belongs to (only if the token is genuine). */
  async signOutWithRefreshToken(refreshToken: string | undefined) {
    if (!refreshToken) return;
    try {
      const { id, secret } = this.parseRefreshToken(refreshToken);
      const session = await this.sessions.findOneBy({ id });
      const presented = sha256(secret);
      if (session && (sameHash(presented, session.tokenHash) || sameHash(presented, session.previousHash))) {
        await this.revoke(session, 'sign-out');
      }
    } catch {
      // Malformed token — nothing to revoke
    }
  }

  async signOutSession(sessionId: string) {
    const session = await this.sessions.findOneBy({ id: sessionId });
    if (session) await this.revoke(session, 'sign-out');
  }

  /** Used by the guard on every authenticated request so revocation is immediate. */
  async isSessionActive(sessionId: string) {
    const session = await this.sessions.findOne({
      where: { id: sessionId },
      select: { id: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.revokedAt) return AUTH_ERROR.sessionRevoked;
    if (session.expiresAt.getTime() <= Date.now()) return AUTH_ERROR.sessionExpired;
    return null;
  }

  // ---------------------------------------------------------------- session management

  listSessions(userId: number) {
    return this.sessions.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { lastUsedAt: 'DESC' },
      select: { id: true, client: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    });
  }

  async revokeSession(userId: number, sessionId: string) {
    const session = await this.sessions.findOneBy({ id: sessionId, userId });
    if (!session) throw new NotFoundException('Session not found');
    await this.revoke(session, 'revoked');
    return { success: true };
  }

  async revokeOtherSessions(userId: number, keepSessionId: string) {
    const result = await this.sessions.update(
      { userId, id: Not(keepSessionId), revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: 'revoked' },
    );
    return { success: true, revoked: result.affected ?? 0 };
  }

  // ---------------------------------------------------------------- account

  async me(id: number) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw unauthorized(AUTH_ERROR.sessionRevoked, 'Account no longer exists');
    return { user };
  }

  async updateAccount(id: number, data: { displayName?: string; email?: string }) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw unauthorized(AUTH_ERROR.sessionRevoked, 'Account no longer exists');
    if (data.email) user.email = data.email.toLowerCase();
    if (data.displayName) user.displayName = data.displayName;
    return { user: await this.users.save(user) };
  }

  /** Changing the password signs out every other device. */
  async changePassword(id: number, currentSessionId: string, currentPassword: string, newPassword: string) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id })
      .getOne();
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);
    const { revoked } = await this.revokeOtherSessions(id, currentSessionId);
    return { success: true, signedOutOtherSessions: revoked };
  }

  // ---------------------------------------------------------------- helpers

  get refreshTtl() {
    return this.refreshTtlMs;
  }

  private async issue(user: User, session: AuthSession, refreshSecret: string | null): Promise<IssuedTokens> {
    const payload: AccessPayload = { sub: user.id, email: user.email, role: user.role, sid: session.id };
    const accessToken = await this.jwt.signAsync(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);
    return {
      accessToken,
      accessTokenExpiresAt: exp * 1000,
      refreshToken: refreshSecret ? `${session.id}.${refreshSecret}` : null,
      refreshTokenExpiresAt: session.expiresAt.getTime(),
      user,
    };
  }

  private parseRefreshToken(token: string | undefined) {
    const [id, secret] = (token ?? '').split('.');
    if (!id || !secret || !/^[0-9a-f-]{36}$/i.test(id)) {
      throw unauthorized(AUTH_ERROR.sessionExpired, 'No valid session — please sign in');
    }
    return { id, secret };
  }

  private async revoke(session: AuthSession, reason: string) {
    if (session.revokedAt) return;
    session.revokedAt = new Date();
    session.revokedReason = reason;
    await this.sessions.save(session);
  }

  private assertNotLockedOut(key: string) {
    const entry = this.failedSignIns.get(key);
    if (!entry) return;
    const elapsed = Date.now() - entry.first;
    if (elapsed > SIGN_IN_WINDOW_MS) {
      this.failedSignIns.delete(key);
      return;
    }
    if (entry.count >= MAX_FAILED_SIGN_INS) {
      const minutes = Math.ceil((SIGN_IN_WINDOW_MS - elapsed) / 60_000);
      throw new HttpException(
        `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailure(key: string) {
    const entry = this.failedSignIns.get(key);
    if (!entry || Date.now() - entry.first > SIGN_IN_WINDOW_MS) {
      this.failedSignIns.set(key, { count: 1, first: Date.now() });
    } else {
      entry.count += 1;
    }
  }
}
