import { Body, Controller, Get, NotFoundException, Param, Patch, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { createCrudController } from '../common/crud.controller';
import { SiteService } from '../site/site.service';
import {
  CreateAboutParagraphDto,
  CreateExperienceDto,
  CreateHighlightDto,
  CreateMarqueeItemDto,
  CreateProjectDto,
  CreateSkillGroupDto,
  CreateStatDto,
  ReorderSectionsDto,
  UpdateAboutParagraphDto,
  UpdateExperienceDto,
  UpdateHighlightDto,
  UpdateMarqueeItemDto,
  UpdateProfileDto,
  UpdateProjectDto,
  UpdateSectionDto,
  UpdateSettingsDto,
  UpdateSkillGroupDto,
  UpdateStatDto,
} from './dto/content.dto';
import {
  AboutParagraph,
  Experience,
  Highlight,
  MarqueeItem,
  Project,
  SkillGroup,
  Stat,
} from './entities/list.entities';
import { Profile } from './entities/profile.entity';
import { Section } from './entities/section.entity';
import { Settings } from './entities/settings.entity';

// ---------------------------------------------------------------- list resources

export const StatsController = createCrudController('stats', Stat, CreateStatDto, UpdateStatDto);
export const AboutParagraphsController = createCrudController(
  'about-paragraphs',
  AboutParagraph,
  CreateAboutParagraphDto,
  UpdateAboutParagraphDto,
);
export const HighlightsController = createCrudController(
  'highlights',
  Highlight,
  CreateHighlightDto,
  UpdateHighlightDto,
);
export const SkillGroupsController = createCrudController(
  'skill-groups',
  SkillGroup,
  CreateSkillGroupDto,
  UpdateSkillGroupDto,
);
export const MarqueeController = createCrudController(
  'marquee',
  MarqueeItem,
  CreateMarqueeItemDto,
  UpdateMarqueeItemDto,
);
export const ExperiencesController = createCrudController(
  'experiences',
  Experience,
  CreateExperienceDto,
  UpdateExperienceDto,
);
export const ProjectsController = createCrudController(
  'projects',
  Project,
  CreateProjectDto,
  UpdateProjectDto,
);

// ---------------------------------------------------------------- singletons

@Controller('profile')
export class ProfileController {
  constructor(
    @InjectRepository(Profile) private readonly repo: Repository<Profile>,
    private readonly site: SiteService,
  ) {}

  @Get()
  async get() {
    return (await this.repo.findOneBy({ id: 1 })) ?? this.repo.save(this.repo.create({ id: 1 }));
  }

  @Put()
  async update(@Body() dto: UpdateProfileDto) {
    const saved = await this.repo.save(this.repo.merge(await this.get(), dto));
    await this.site.refreshSnapshot();
    return saved;
  }
}

@Controller('settings')
export class SettingsController {
  constructor(
    @InjectRepository(Settings) private readonly repo: Repository<Settings>,
    private readonly site: SiteService,
  ) {}

  @Get()
  async get() {
    return (await this.repo.findOneBy({ id: 1 })) ?? this.repo.save(this.repo.create({ id: 1 }));
  }

  @Put()
  async update(@Body() dto: UpdateSettingsDto) {
    const saved = await this.repo.save(this.repo.merge(await this.get(), dto));
    await this.site.refreshSnapshot();
    return saved;
  }
}

@Controller('sections')
export class SectionsController {
  constructor(
    @InjectRepository(Section) private readonly repo: Repository<Section>,
    private readonly site: SiteService,
  ) {}

  @Get()
  findAll() {
    return this.repo.find({ order: { sortOrder: 'ASC' } });
  }

  @Patch('reorder')
  async reorder(@Body() { keys }: ReorderSectionsDto) {
    const rows = await this.findAll();
    for (const row of rows) {
      const index = keys.indexOf(row.key);
      if (index >= 0) row.sortOrder = index + 1;
    }
    await this.repo.save(rows);
    await this.site.refreshSnapshot();
    return this.findAll();
  }

  @Get(':key')
  async findOne(@Param('key') key: string) {
    const row = await this.repo.findOneBy({ key: key as Section['key'] });
    if (!row) throw new NotFoundException(`Section "${key}" not found`);
    return row;
  }

  @Put(':key')
  async update(@Param('key') key: string, @Body() dto: UpdateSectionDto) {
    const saved = await this.repo.save(this.repo.merge(await this.findOne(key), dto));
    await this.site.refreshSnapshot();
    return saved;
  }
}
