import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Contact-form submissions from the website. */
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn() id: number;
  @Column() name: string;
  @Column() email: string;
  @Column({ type: 'text' }) message: string;
  @Column({ default: false }) read: boolean;
  @CreateDateColumn() createdAt: Date;
}
