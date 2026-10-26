import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) email: string;
  @Column({ default: 'Admin' }) displayName: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone: string | null;
  @Column({ select: false }) passwordHash: string;
  @Column({ default: 'admin' }) role: string;
  @CreateDateColumn() createdAt: Date;
}
