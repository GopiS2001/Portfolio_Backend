import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type ThemeMode = 'light' | 'dark' | 'system';

export const DESIGN_STYLES = ['neumorphism', 'glassmorphism', 'claymorphism', 'skeuomorphism', 'zephyr'] as const;
export type DesignStyle = (typeof DESIGN_STYLES)[number];

/** Singleton row (id = 1): everything the Configuration page controls. */
@Entity('settings')
export class Settings {
  @PrimaryColumn({ default: 1 })
  id: number;

  // Site
  @Column({ default: true }) siteEnabled: boolean;
  @Column({ default: 'This site is being updated. Please check back soon.' })
  maintenanceMessage: string;
  @Column({ default: '' }) siteTitle: string;
  @Column({ type: 'text', nullable: true }) metaDescription: string | null;

  // Header
  @Column({ default: true }) showHeader: boolean;
  @Column({ default: true }) showHeaderCta: boolean;
  @Column({ default: 'Contact me' }) headerCtaLabel: string;

  // Theme
  @Column({ default: true }) enableThemeToggle: boolean;
  @Column({ type: 'varchar', length: 10, default: 'system' }) defaultTheme: ThemeMode;
  @Column({ default: '#a87a32' }) accentLight: string;
  @Column({ default: '#d9b26a' }) accentDark: string;
  /** Surface look for every visitor (cards, buttons, inputs, navigation). */
  @Column({ type: 'varchar', length: 20, default: 'neumorphism' }) designStyle: DesignStyle;
  /** Lets visitors try the other design styles from a switcher in the header. */
  @Column({ default: false }) enableStyleSwitcher: boolean;

  // Typography
  @Column({ default: 'Geist' }) fontSans: string;
  @Column({ default: 'Instrument Serif' }) fontSerif: string;
  /** Root font size in px — every rem-based size on the site scales with it. */
  @Column({ default: 16 }) baseFontSize: number;
  /** Heading size multiplier in percent. */
  @Column({ default: 100 }) headingScale: number;

  // Blocks
  @Column({ default: true }) showStats: boolean;
  @Column({ default: true }) showMarquee: boolean;
  @Column({ default: true }) showResumeButton: boolean;
  @Column({ default: true }) showContactForm: boolean;
  @Column({ default: true }) showFooter: boolean;
  @Column({ default: true }) showWhatsappButton: boolean;
  @Column({ default: true }) enableAnimations: boolean;

  @UpdateDateColumn() updatedAt: Date;
}
