import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CookieOptions, Request, Response } from 'express';

import { createOriginPolicy } from '../common/origins';
import { JwtPayload, Public } from './auth.guard';
import { AccessPayload, AuthService, IssuedTokens } from './auth.service';

class SignInDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) password: string;
  /** Mobile app: "native" returns the refresh token in the body instead of a cookie. */
  @IsOptional() @IsIn(['native']) client?: 'native';
}

class RefreshDto {
  /** Mobile app only — browsers send the httpOnly cookie instead. */
  @IsOptional() @IsString() @MaxLength(200) refreshToken?: string;
}

class UpdateAccountDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
}

class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(6) newPassword: string;
}

type AuthedRequest = Request & { user: JwtPayload };

/** Browser apps get separate cookies so the dashboard and website keep independent sessions. */
const WEB_APPS = ['dashboard', 'website'] as const;
type WebApp = (typeof WEB_APPS)[number];
const cookieName = (app: WebApp) => `pf_rt_${app}`;

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/**
 * Tokens:
 *   access  — 15-minute JWT, sent as `Authorization: Bearer`, kept in memory by the clients
 *   refresh — 7-day opaque token, rotated on every use
 *             browsers: httpOnly cookie scoped to /api/auth (pf_rt_dashboard / pf_rt_website)
 *             mobile app: returned in the body and kept in the device's secure storage
 */
@Controller('auth')
export class AuthController {
  private readonly origins = createOriginPolicy();

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Post('sign-in')
  @HttpCode(200)
  async signIn(@Body() dto: SignInDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const native = dto.client === 'native';
    const app = native ? null : this.webApp(req);
    const tokens = await this.auth.signIn(dto.email, dto.password, {
      client: app ?? 'native',
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    if (app) this.setCookie(res, app, tokens.refreshToken!);
    return this.body(tokens, native);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (dto.refreshToken) {
      return this.body(await this.auth.refresh(dto.refreshToken, { ip: req.ip }), true);
    }

    const app = this.webApp(req);
    try {
      const tokens = await this.auth.refresh(readCookie(req, cookieName(app)), { ip: req.ip });
      // Null inside the rotation grace window: the browser already has the newer cookie
      if (tokens.refreshToken) this.setCookie(res, app, tokens.refreshToken);
      return this.body(tokens, false);
    } catch (error) {
      if (error instanceof UnauthorizedException) res.clearCookie(cookieName(app), this.cookieOptions());
      throw error;
    }
  }

  /** Public so it also works after the access token expired. Always succeeds. */
  @Public()
  @Post('sign-out')
  @HttpCode(200)
  async signOut(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (dto.refreshToken) {
      await this.auth.signOutWithRefreshToken(dto.refreshToken);
    } else {
      const app = this.webApp(req);
      await this.auth.signOutWithRefreshToken(readCookie(req, cookieName(app)));
      res.clearCookie(cookieName(app), this.cookieOptions());
    }

    // Also end the session the access token belongs to, if one was sent
    const [type, token] = (req.headers.authorization ?? '').split(' ');
    if (type === 'Bearer' && token) {
      try {
        const { sid } = await this.jwt.verifyAsync<AccessPayload>(token, { ignoreExpiration: true });
        if (sid) await this.auth.signOutSession(sid);
      } catch {}
    }
    return { success: true };
  }

  @Get('me')
  me(@Req() req: AuthedRequest) {
    return this.auth.me(req.user.sub);
  }

  @Put('account')
  updateAccount(@Req() req: AuthedRequest, @Body() dto: UpdateAccountDto) {
    return this.auth.updateAccount(req.user.sub, dto);
  }

  @Put('password')
  changePassword(@Req() req: AuthedRequest, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.sub, req.user.sid, dto.currentPassword, dto.newPassword);
  }

  // ---------------------------------------------------------------- sessions

  @Get('sessions')
  async sessions(@Req() req: AuthedRequest) {
    const rows = await this.auth.listSessions(req.user.sub);
    return rows.map((s) => ({ ...s, current: s.id === req.user.sid }));
  }

  @Delete('sessions/:id')
  revokeSession(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.auth.revokeSession(req.user.sub, id);
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  revokeOthers(@Req() req: AuthedRequest) {
    return this.auth.revokeOtherSessions(req.user.sub, req.user.sid);
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Cookie-based calls must name the app in a custom header (forces a CORS preflight, so
   * other sites can't send it — CSRF protection) and come from a trusted origin.
   */
  private webApp(req: Request): WebApp {
    const app = String(req.headers['x-client-app'] ?? '') as WebApp;
    if (!WEB_APPS.includes(app)) throw new BadRequestException('Missing or unknown X-Client-App header');
    const origin = req.headers.origin;
    if (origin && !this.origins.isTrusted(origin)) throw new ForbiddenException('Origin not allowed');
    return app;
  }

  private cookieOptions(): CookieOptions {
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>('COOKIE_SAMESITE', 'lax');
    const secureDefault = String(this.config.get('PUBLIC_URL', '')).startsWith('https://');
    const secure = sameSite === 'none' || this.config.get('COOKIE_SECURE', String(secureDefault)) === 'true';
    return { httpOnly: true, secure, sameSite, path: '/api/auth' };
  }

  private setCookie(res: Response, app: WebApp, refreshToken: string) {
    res.cookie(cookieName(app), refreshToken, { ...this.cookieOptions(), maxAge: this.auth.refreshTtl });
  }

  private body(tokens: IssuedTokens, includeRefreshToken: boolean) {
    return {
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      user: tokens.user,
      ...(includeRefreshToken ? { refreshToken: tokens.refreshToken } : {}),
    };
  }
}
