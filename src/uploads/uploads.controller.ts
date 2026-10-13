import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { unlinkSync } from 'fs';
import { basename, extname, join } from 'path';
import { diskStorage } from 'multer';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');

const ALLOWED = /\.(png|jpe?g|webp|gif|svg|avif|pdf|apk)$/i;
const isApk = (name: string) => /\.apk$/i.test(name);

const MB = 1024 * 1024;
const MAX_APK = 200 * MB;
const MAX_OTHER = 10 * MB;

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

/** Images (avatar, project covers), PDFs (résumé) and APKs (app builds). Served back from /uploads. */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_APK },
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, storedName(file.originalname)),
      }),
      fileFilter: (_req, file, cb) =>
        ALLOWED.test(file.originalname)
          ? cb(null, true)
          : cb(new BadRequestException('Only images, PDF and APK files are allowed'), false),
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded (field name must be "file")');
    if (!isApk(file.originalname) && file.size > MAX_OTHER) {
      unlinkSync(file.path);
      throw new BadRequestException('Images and PDFs must be 10 MB or smaller');
    }
    const base = this.config.get('PUBLIC_URL', `http://localhost:${this.config.get('PORT', 4000)}`);
    return { url: `${base.replace(/\/$/, '')}/uploads/${file.filename}`, name: file.originalname };
  }
}
