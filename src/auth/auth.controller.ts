import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { JwtPayload, Public } from './auth.guard';
import { AuthService } from './auth.service';

class SignInDto {
  @IsEmail() email: string;
  @IsString() @MinLength(1) password: string;
}

class UpdateAccountDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
}

class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(6) newPassword: string;
}

type AuthedRequest = { user: JwtPayload };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('sign-in')
  signIn(@Body() dto: SignInDto) {
    return this.auth.signIn(dto.email, dto.password);
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
    return this.auth.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }
}
