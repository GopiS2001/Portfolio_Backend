import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { PROJECT_CATEGORIES, ProjectCategory } from '../entities/list.entities';

// ---------------------------------------------------------------- shared

/** Fields every list item accepts. */
export class OrderedDto {
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() visible?: boolean;
}

export class ReorderDto {
  @IsArray() @IsInt({ each: true }) ids: number[];
}

const Str = (max = 255) => [IsString(), MaxLength(max)];
const apply =
  (...decorators: PropertyDecorator[]): PropertyDecorator =>
  (target, key) =>
    decorators.forEach((d) => d(target, key));
const S = (max = 255) => apply(...Str(max));
const OptS = (max = 255) => apply(IsOptional(), ...Str(max));
const StrList = () => apply(IsArray(), ArrayMaxSize(100), IsString({ each: true }));

// ---------------------------------------------------------------- list items

export class CreateStatDto extends OrderedDto {
  @S(40) value: string;
  @S(80) label: string;
}
export class UpdateStatDto extends PartialType(CreateStatDto) {}

export class CreateAboutParagraphDto extends OrderedDto {
  @S(5000) content: string;
}
export class UpdateAboutParagraphDto extends PartialType(CreateAboutParagraphDto) {}

export class CreateHighlightDto extends OrderedDto {
  @S(120) title: string;
  @OptS(255) text?: string;
}
export class UpdateHighlightDto extends PartialType(CreateHighlightDto) {}

export class CreateSkillGroupDto extends OrderedDto {
  @S(120) title: string;
  @OptS(40) icon?: string;
  @StrList() skills: string[];
}
export class UpdateSkillGroupDto extends PartialType(CreateSkillGroupDto) {}

export class CreateMarqueeItemDto extends OrderedDto {
  @S(80) label: string;
}
export class UpdateMarqueeItemDto extends PartialType(CreateMarqueeItemDto) {}

export class CreateExperienceDto extends OrderedDto {
  @S(120) role: string;
  @S(120) company: string;
  @OptS(80) period?: string;
  @OptS(120) location?: string;
  @OptS(10000) description?: string;
  @StrList() stack: string[];
}
export class UpdateExperienceDto extends PartialType(CreateExperienceDto) {}

export class ProjectLinkDto {
  @S(60) label: string;
  @S(500) url: string;
}

export class CreateProjectDto extends OrderedDto {
  @S(120) title: string;
  @IsOptional() @IsIn(PROJECT_CATEGORIES) category?: ProjectCategory;
  @S(5000) description: string;
  @StrList() tags: string[];
  @OptS(500) liveUrl?: string;
  @OptS(500) sourceUrl?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ProjectLinkDto)
  links?: ProjectLinkDto[];
  @OptS(500) imageUrl?: string;
  @OptS(500) apkUrl?: string;
  @OptS(160) gradient?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
}
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

// ---------------------------------------------------------------- singletons

export class UpdateProfileDto {
  @OptS(120) name?: string;
  @OptS(120) role?: string;
  @OptS(120) location?: string;
  @OptS(500) avatarUrl?: string;
  @OptS(500) resumeUrl?: string;
  @IsOptional() @IsBoolean() available?: boolean;
  @OptS(120) availabilityText?: string;
  @OptS(200) heroTitle?: string;
  @OptS(200) heroHighlight?: string;
  @OptS(200) heroTitleSuffix?: string;
  @OptS(2000) tagline?: string;
  @OptS(60) primaryCtaLabel?: string;
  @OptS(60) resumeCtaLabel?: string;
  @OptS(160) email?: string;
  @OptS(40) phone?: string;
  @OptS(40) whatsapp?: string;
  @OptS(2000) contactIntro?: string;
  @OptS(500) github?: string;
  @OptS(500) linkedin?: string;
  @OptS(500) instagram?: string;
  @OptS(500) twitter?: string;
  @OptS(500) website?: string;
  @OptS(200) footerText?: string;
}

export class UpdateSettingsDto {
  @IsOptional() @IsBoolean() siteEnabled?: boolean;
  @OptS(255) maintenanceMessage?: string;
  @OptS(160) siteTitle?: string;
  @OptS(500) metaDescription?: string;
  @IsOptional() @IsBoolean() showHeader?: boolean;
  @IsOptional() @IsBoolean() showHeaderCta?: boolean;
  @OptS(40) headerCtaLabel?: string;
  @IsOptional() @IsBoolean() enableThemeToggle?: boolean;
  @IsOptional() @IsIn(['light', 'dark', 'system']) defaultTheme?: 'light' | 'dark' | 'system';
  @OptS(20) accentLight?: string;
  @OptS(20) accentDark?: string;
  @OptS(80) fontSans?: string;
  @OptS(80) fontSerif?: string;
  @IsOptional() @IsInt() @Min(12) @Max(24) baseFontSize?: number;
  @IsOptional() @IsInt() @Min(70) @Max(140) headingScale?: number;
  @IsOptional() @IsBoolean() showStats?: boolean;
  @IsOptional() @IsBoolean() showMarquee?: boolean;
  @IsOptional() @IsBoolean() showResumeButton?: boolean;
  @IsOptional() @IsBoolean() showContactForm?: boolean;
  @IsOptional() @IsBoolean() showFooter?: boolean;
  @IsOptional() @IsBoolean() showWhatsappButton?: boolean;
  @IsOptional() @IsBoolean() enableAnimations?: boolean;
}

export class UpdateSectionDto {
  @IsOptional() @IsBoolean() visible?: boolean;
  @IsOptional() @IsBoolean() showInNav?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @OptS(40) navLabel?: string;
  @OptS(80) eyebrow?: string;
  @OptS(200) title?: string;
  @OptS(200) highlight?: string;
  @OptS(200) titleSuffix?: string;
}

export class ReorderSectionsDto {
  @IsArray() @IsString({ each: true }) keys: string[];
}
