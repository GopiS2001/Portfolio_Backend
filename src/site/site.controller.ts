import { Controller, Get, Post } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { Public } from '../auth/auth.guard';
import { SiteService } from './site.service';

@Controller()
export class SiteController {
  constructor(
    private readonly site: SiteService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /** Everything the public website renders, in one request. */
  @Public()
  @Get('public/site')
  getSite() {
    return this.site.getPublicSite();
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', database: this.db.isInitialized ? 'up' : 'down' };
  }

  /** Counts for the admin dashboard overview. */
  @Get('dashboard/summary')
  async summary() {
    const count = (table: string, where = '') =>
      this.db.query(`SELECT COUNT(*) AS n FROM \`${table}\` ${where}`).then((r) => Number(r[0].n));

    const [projects, experiences, skillGroups, skills, messages, unread] = await Promise.all([
      count('projects'),
      count('experiences'),
      count('skill_groups'),
      this.db
        .query('SELECT skills FROM skill_groups')
        .then((rows: { skills: string[] | string }[]) =>
          rows.reduce((n, r) => n + (typeof r.skills === 'string' ? JSON.parse(r.skills) : r.skills).length, 0),
        ),
      count('messages'),
      count('messages', 'WHERE `read` = 0'),
    ]);
    return { projects, experiences, skillGroups, skills, messages, unread };
  }

  /** Manually rebuild the offline snapshot files. */
  @Post('site/snapshot')
  async snapshot() {
    await this.site.refreshSnapshot();
    return { success: true, generatedAt: new Date().toISOString() };
  }
}
