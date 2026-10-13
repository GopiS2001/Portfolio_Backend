import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { User } from './auth/user.entity';
import {
  AboutParagraphsController,
  ExperiencesController,
  HighlightsController,
  MarqueeController,
  ProfileController,
  ProjectsController,
  SectionsController,
  SettingsController,
  SkillGroupsController,
  StatsController,
} from './content/content.controllers';
import {
  AboutParagraph,
  Experience,
  Highlight,
  MarqueeItem,
  Project,
  SkillGroup,
  Stat,
} from './content/entities/list.entities';
import { Profile } from './content/entities/profile.entity';
import { Section } from './content/entities/section.entity';
import { Settings } from './content/entities/settings.entity';
import { Message } from './messages/message.entity';
import { MessagesController } from './messages/messages.controller';
import { SeedService } from './seed/seed.service';
import { SiteController } from './site/site.controller';
import { SiteService } from './site/site.service';
import { UploadsController } from './uploads/uploads.controller';

const entities = [
  User,
  Profile,
  Settings,
  Section,
  Stat,
  AboutParagraph,
  Highlight,
  SkillGroup,
  MarqueeItem,
  Experience,
  Project,
  Message,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 3306)),
        username: config.get('DB_USER', 'root'),
        password: config.get('DB_PASSWORD', ''),
        database: config.get('DB_NAME', 'portfolio'),
        entities,
        synchronize: config.get('DB_SYNC', 'true') === 'true',
        charset: 'utf8mb4',
      }),
    }),
    TypeOrmModule.forFeature(entities),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'change-me'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [
    AuthController,
    SiteController,
    ProfileController,
    SettingsController,
    SectionsController,
    StatsController,
    AboutParagraphsController,
    HighlightsController,
    SkillGroupsController,
    MarqueeController,
    ExperiencesController,
    ProjectsController,
    MessagesController,
    UploadsController,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }, AuthService, SeedService, SiteService],
})
export class AppModule {}
