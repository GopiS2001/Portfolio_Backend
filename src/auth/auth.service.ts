import { BadRequestException, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';

import { User } from './user.entity';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Creates the first admin from .env when the users table is empty. */
  async onModuleInit() {
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

  async signIn(email: string, password: string) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: email.toLowerCase() })
      .getOne();
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { accessToken };
  }

  async me(id: number) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new UnauthorizedException();
    return { user };
  }

  async updateAccount(id: number, data: { displayName?: string; email?: string }) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new UnauthorizedException();
    if (data.email) user.email = data.email.toLowerCase();
    if (data.displayName) user.displayName = data.displayName;
    return { user: await this.users.save(user) };
  }

  async changePassword(id: number, currentPassword: string, newPassword: string) {
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
    return { success: true };
  }
}
