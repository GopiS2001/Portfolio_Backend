import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join } from 'path';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import { Repository } from 'typeorm';

import { Public } from '../auth/auth.guard';
import { publicBaseUrl } from '../common/database';
import { CHUNK_SIZE, StoredFile, StoredFileChunk } from './stored-file.entity';

/** Files uploaded before storage moved into the database (local installs only). */
export const UPLOAD_DIR = join(process.cwd(), 'uploads');

const ALLOWED = /\.(png|jpe?g|webp|gif|svg|avif|pdf|apk)$/i;
const isApk = (name: string) => /\.apk$/i.test(name);

const MB = 1024 * 1024;
const MAX_APK = 200 * MB;
const MAX_OTHER = 10 * MB;

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
  // Phones only offer to install an APK when it arrives with this type, as a download
  '.apk': 'application/vnd.android.package-archive',
};
export const mimeFor = (name: string) => MIME[extname(name).toLowerCase()] ?? 'application/octet-stream';

/** APKs keep a readable name (it is what visitors see when the download is saved). */
function storedName(original: string) {
  const ext = extname(original).toLowerCase();
  if (!isApk(original)) return `${randomUUID()}${ext}`;
  const base = basename(original, extname(original))
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'app'}-${randomUUID().slice(0, 8)}${ext}`;
}

/** Images (avatar, project covers), PDFs (résumé) and APKs (app builds). Stored in the database. */
@Controller('uploads')
export class UploadsController {
  constructor(
    @InjectRepository(StoredFile) private readonly files: Repository<StoredFile>,
    @InjectRepository(StoredFileChunk) private readonly chunks: Repository<StoredFileChunk>,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_APK },
      // Spool to the temp folder first, then copy into the database chunk by chunk (keeps memory low)
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, cb) => cb(null, storedName(file.originalname)),
      }),
      fileFilter: (_req, file, cb) =>
        ALLOWED.test(file.originalname)
          ? cb(null, true)
          : cb(new BadRequestException('Only images, PDF and APK files are allowed'), false),
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded (field name must be "file")');
    try {
      if (!isApk(file.originalname) && file.size > MAX_OTHER) {
        throw new BadRequestException('Images and PDFs must be 10 MB or smaller');
      }
      await this.store(file.filename, file.originalname, file.path, file.size);
      return { url: `${publicBaseUrl()}/uploads/${file.filename}`, name: file.originalname };
    } finally {
      await unlink(file.path).catch(() => undefined);
    }
  }

  /** Copies a file from disk into the database. The file row is written last, so a half-stored upload is never served. */
  async store(name: string, originalName: string, path: string, size: number) {
    let idx = 0;
    try {
      const stream = createReadStream(path, { highWaterMark: CHUNK_SIZE });
      for await (const piece of stream) {
        await this.chunks.insert({ fileName: name, idx: idx++, data: piece as Buffer });
      }
      await this.files.insert({ name, originalName: originalName.slice(0, 255), mimeType: mimeFor(name), size, chunkCount: idx });
    } catch (error) {
      await this.chunks.delete({ fileName: name });
      throw error;
    }
  }
}

/** GET /uploads/<name> — outside the /api prefix so file links stay short and stable. */
@Controller('uploads')
export class FilesController {
  constructor(
    @InjectRepository(StoredFile) private readonly files: Repository<StoredFile>,
    @InjectRepository(StoredFileChunk) private readonly chunks: Repository<StoredFileChunk>,
  ) {}

  @Public()
  @Get(':name')
  async serve(@Param('name') name: string, @Res() res: Response) {
    if (!/^[\w.-]+$/.test(name)) throw new NotFoundException();

    const file = await this.files.findOneBy({ name });
    if (!file) {
      // Local installs: files uploaded before they were stored in the database
      const legacy = join(UPLOAD_DIR, name);
      if (!existsSync(legacy)) throw new NotFoundException('File not found');
      this.setHeaders(res, name);
      return createReadStream(legacy).pipe(res);
    }

    this.setHeaders(res, name, file.size);
    // Stream one chunk at a time so a 200 MB APK never sits in memory
    for (let idx = 0; idx < file.chunkCount; idx++) {
      const chunk = await this.chunks.findOne({ where: { fileName: name, idx }, select: { data: true } });
      if (!chunk) break;
      if (!res.write(chunk.data)) await new Promise((resolve) => res.once('drain', resolve));
    }
    res.end();
  }

  private setHeaders(res: Response, name: string, size?: number) {
    res.setHeader('Content-Type', mimeFor(name));
    if (size !== undefined) res.setHeader('Content-Length', String(size));
    // Names are unique per upload, so browsers and CDNs may keep them forever
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (isApk(name)) res.setHeader('Content-Disposition', 'attachment');
  }
}
