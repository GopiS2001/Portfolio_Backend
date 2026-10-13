import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SessionClient = 'dashboard' | 'website' | 'native';

/**
 * One row per sign-in. The refresh token is `<id>.<secret>`; only a SHA-256 hash of the
 * secret is stored. Every refresh rotates the secret (the previous hash is kept briefly so
 * two tabs refreshing at the same moment don't trip reuse detection).
 */
@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column() userId: number;

  @Column({ type: 'char', length: 64 }) tokenHash: string;
  @Column({ type: 'char', length: 64, nullable: true }) previousHash: string | null;
  @Column({ type: 'datetime', nullable: true }) rotatedAt: Date | null;

  /** Sliding: pushed 7 days out on every refresh. */
  @Column({ type: 'datetime' }) expiresAt: Date;
  @Column({ type: 'datetime', nullable: true }) revokedAt: Date | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) revokedReason: string | null;

  @Column({ type: 'varchar', length: 20 }) client: SessionClient;
  @Column({ type: 'varchar', length: 255, default: '' }) userAgent: string;
  @Column({ type: 'varchar', length: 64, default: '' }) ip: string;

  @CreateDateColumn() createdAt: Date;
  @Column({ type: 'datetime' }) lastUsedAt: Date;
}
