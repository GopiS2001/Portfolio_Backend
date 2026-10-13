import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Shared columns for every orderable, hideable list item. */
export abstract class OrderedEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  visible: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
