import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const SECTION_KEYS = ['home', 'about', 'skills', 'experience', 'projects', 'contact'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** One row per website section: on/off toggle, order, nav label and heading copy. */
@Entity('sections')
export class Section {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  key: SectionKey;

  @Column({ default: true }) visible: boolean;
  @Column({ default: true }) showInNav: boolean;
  @Column({ default: 0 }) sortOrder: number;
  @Column({ default: '' }) navLabel: string;
  @Column({ default: '' }) eyebrow: string;
  @Column({ default: '' }) title: string;
  @Column({ default: '' }) highlight: string;
  @Column({ default: '' }) titleSuffix: string;

  @UpdateDateColumn() updatedAt: Date;
}
