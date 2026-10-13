import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Singleton row (id = 1): who you are, hero copy and every contact / social link. */
@Entity('profile')
export class Profile {
  @PrimaryColumn({ default: 1 })
  id: number;

  // Identity
  @Column({ default: '' }) name: string;
  @Column({ default: '' }) role: string;
  @Column({ default: '' }) location: string;
  @Column({ default: '' }) avatarUrl: string;
  @Column({ default: '' }) resumeUrl: string;

  // Hero
  @Column({ default: true }) available: boolean;
  @Column({ default: 'Available for new projects' }) availabilityText: string;
  /** `{name}` is replaced with the profile name. */
  @Column({ default: '{name}' }) heroTitle: string;
  @Column({ default: 'digital experiences' }) heroHighlight: string;
  @Column({ default: 'with precision.' }) heroTitleSuffix: string;
  @Column({ type: 'text', nullable: true }) tagline: string | null;
  @Column({ default: 'View my work' }) primaryCtaLabel: string;
  @Column({ default: 'Download résumé' }) resumeCtaLabel: string;

  // Contact
  @Column({ default: '' }) email: string;
  @Column({ default: '' }) phone: string;
  @Column({ default: '' }) whatsapp: string;
  @Column({ type: 'text', nullable: true }) contactIntro: string | null;

  // Socials
  @Column({ default: '' }) github: string;
  @Column({ default: '' }) linkedin: string;
  @Column({ default: '' }) instagram: string;
  @Column({ default: '' }) twitter: string;
  @Column({ default: '' }) website: string;

  // Footer
  @Column({ default: 'Designed & built with care.' }) footerText: string;

  @UpdateDateColumn() updatedAt: Date;
}
