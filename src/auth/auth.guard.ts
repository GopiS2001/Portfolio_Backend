import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';

import { AccessPayload, AUTH_ERROR, AuthService, unauthorized } from './auth.service';

const IS_PUBLIC = 'isPublic';
/** Marks a route (or controller) as reachable without a token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export type JwtPayload = AccessPayload;

/**
 * Global guard: every route needs a valid Bearer access token unless marked @Public().
 * The token's session is checked on every request, so signing out or revoking a
 * session takes effect immediately rather than when the 15-minute token expires.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const [type, token] = (request.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) {
      throw unauthorized(AUTH_ERROR.accessTokenInvalid, 'Missing access token');
    }

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token);
    } catch (error) {
      throw error instanceof TokenExpiredError
        ? unauthorized(AUTH_ERROR.accessTokenExpired, 'Access token expired')
        : unauthorized(AUTH_ERROR.accessTokenInvalid, 'Invalid access token');
    }

    // Tokens issued before sessions existed have no `sid` — make those sign in again
    if (!payload.sid) throw unauthorized(AUTH_ERROR.sessionRevoked, 'Please sign in again');
    const problem = await this.auth.isSessionActive(payload.sid);
    if (problem) {
      throw unauthorized(
        problem,
        problem === AUTH_ERROR.sessionExpired ? 'Your session expired' : 'This session was signed out',
      );
    }

    request.user = payload;
    return true;
  }
}
