import { Column, Entity } from 'typeorm';

import { OrderedEntity } from '../../common/base.entity';

@Entity('stats')
export class Stat extends OrderedEntity {
  @Column() value: string;
  @Column() label: string;
}

@Entity('about_paragraphs')
export class AboutParagraph extends OrderedEntity {
  @Column({ type: 'text' }) content: string;
}

@Entity('highlights')
export class Highlight extends OrderedEntity {
  @Column() title: string;
  @Column({ default: '' }) text: string;
}

@Entity('skill_groups')
export class SkillGroup extends OrderedEntity {
  @Column() title: string;
  /** Icon key understood by the website (layout, server, database, wrench, ...). */
  @Column({ default: 'layout' }) icon: string;
  @Column({ type: 'json' }) skills: string[];
}

@Entity('marquee_items')
export class MarqueeItem extends OrderedEntity {
  @Column() label: string;
}

@Entity('experiences')
export class Experience extends OrderedEntity {
  @Column() role: string;
  @Column() company: string;
  @Column({ default: '' }) period: string;
  @Column({ default: '' }) location: string;
  /** Explanation of the project(s) worked on in this role. Blank lines separate paragraphs. */
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'json' }) stack: string[];
}

export const PROJECT_CATEGORIES = ['office', 'personal'] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export type ProjectLink = { label: string; url: string };

@Entity('projects')
export class Project extends OrderedEntity {
  @Column() title: string;
  /** Filter group on the website: work done for an employer, or a personal project. */
  @Column({ default: 'personal' }) category: ProjectCategory;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'json' }) tags: string[];
  @Column({ default: '' }) liveUrl: string;
  @Column({ default: '' }) sourceUrl: string;
  /** Extra live links, e.g. a separate admin dashboard or web app. */
  @Column({ type: 'json', nullable: true }) links: ProjectLink[] | null;
  @Column({ default: '' }) imageUrl: string;
  /** Android build (.apk) offered as a download on the website. */
  @Column({ default: '' }) apkUrl: string;
  /** Tailwind gradient used for the generated cover when there is no image. */
  @Column({ default: 'from-amber-300 via-orange-400 to-rose-500' }) gradient: string;
  @Column({ default: false }) featured: boolean;
}
