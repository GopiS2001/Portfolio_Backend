import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { stat, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { Repository } from 'typeorm';

import {
  AboutParagraph,
  Experience,
  Highlight,
  MarqueeItem,
  Project,
  SkillGroup,
  Stat,
} from '../content/entities/list.entities';
import { Profile } from '../content/entities/profile.entity';
import { Section } from '../content/entities/section.entity';
import { Settings } from '../content/entities/settings.entity';

const visibleSorted = { where: { visible: true }, order: { sortOrder: 'ASC', id: 'ASC' } } as const;

/** Strips DB bookkeeping columns so the public payload stays lean. */
function clean<T extends object>(rows: T[]) {
  return rows.map(({ createdAt, updatedAt, visible, sortOrder, ...rest }: any) => rest);
}

/**
 * Builds the single public JSON document the website renders, and mirrors it to
 * snapshot files so the static site can show the exact same data offline.
 */
@Injectable()
export class SiteService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SiteService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Profile) private readonly profile: Repository<Profile>,
    @InjectRepository(Settings) private readonly settings: Repository<Settings>,
    @InjectRepository(Section) private readonly sections: Repository<Section>,
    @InjectRepository(Stat) private readonly stats: Repository<Stat>,
    @InjectRepository(AboutParagraph) private readonly paragraphs: Repository<AboutParagraph>,
    @InjectRepository(Highlight) private readonly highlights: Repository<Highlight>,
    @InjectRepository(SkillGroup) private readonly skillGroups: Repository<SkillGroup>,
    @InjectRepository(MarqueeItem) private readonly marquee: Repository<MarqueeItem>,
    @InjectRepository(Experience) private readonly experience: Repository<Experience>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
  ) {}

  async onApplicationBootstrap() {
    await this.refreshSnapshot();
  }

  async getPublicSite() {
    const [profile, settings, sections, stats, paragraphs, highlights, groups, marquee, experience, projects] =
      await Promise.all([
        this.profile.findOneBy({ id: 1 }),
        this.settings.findOneBy({ id: 1 }),
        this.sections.find({ order: { sortOrder: 'ASC' } }),
        this.stats.find(visibleSorted),
        this.paragraphs.find(visibleSorted),
        this.highlights.find(visibleSorted),
        this.skillGroups.find(visibleSorted),
        this.marquee.find(visibleSorted),
        this.experience.find(visibleSorted),
        this.projects.find(visibleSorted),
      ]);

    const { id: _p, updatedAt: _pu, ...profileData } = profile ?? ({} as Profile);
    const { id: _s, updatedAt: _su, ...settingsData } = settings ?? ({} as Settings);

    return {
      generatedAt: new Date().toISOString(),
      settings: settingsData,
      profile: profileData,
      sections: sections.map(({ updatedAt, ...s }) => s),
      stats: clean(stats),
      about: { paragraphs: paragraphs.map((p) => p.content), highlights: clean(highlights) },
      skills: { groups: clean(groups), marquee: marquee.map((m) => m.label) },
      experience: clean(experience),
      projects: clean(projects),
    };
  }

  /** Rewrites every configured snapshot file. Never throws — a failed write must not fail the request. */
  async refreshSnapshot() {
    const targets = (this.config.get<string>('SNAPSHOT_PATHS') ?? '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!targets.length) return;

    try {
      const json = JSON.stringify(await this.getPublicSite(), null, 2);
      await Promise.all(
        targets.map(async (target) => {
          const file = resolve(process.cwd(), target);
          try {
            // Only write into folders that already exist (e.g. skip WEBSITE/out before the first build)
            await stat(dirname(file));
          } catch {
            return;
          }
          try {
            await writeFile(file, json, 'utf8');
          } catch (err) {
            this.logger.warn(`Snapshot not written to ${file}: ${(err as Error).message}`);
          }
        }),
      );
    } catch (err) {
      this.logger.error(`Snapshot build failed: ${(err as Error).message}`);
    }
  }
}
