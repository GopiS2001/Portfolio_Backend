import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Uploaded files live in the database, so they survive restarts on hosts with a temporary disk
 * (Render's free plan). Content is split into chunks because TiDB limits the size of one row.
 */
@Entity('stored_files')
export class StoredFile {
  /** Name used in the URL: /uploads/<name> */
  @PrimaryColumn({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 255, default: '' }) originalName: string;
  @Column({ type: 'varchar', length: 120 }) mimeType: string;
  @Column({ type: 'bigint', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  size: number;
  @Column({ type: 'int' }) chunkCount: number;
  @CreateDateColumn() createdAt: Date;
}

@Entity('stored_file_chunks')
export class StoredFileChunk {
  @PrimaryColumn({ type: 'varchar', length: 120 }) fileName: string;
  @PrimaryColumn({ type: 'int' }) idx: number;
  @Column({ type: 'longblob' }) data: Buffer;
}

/** 2 MB per row keeps well inside TiDB's per-row limit. */
export const CHUNK_SIZE = 2 * 1024 * 1024;
