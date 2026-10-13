import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsBoolean, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Repository } from 'typeorm';

import { Public } from '../auth/auth.guard';
import { Message } from './message.entity';

class CreateMessageDto {
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsEmail() @MaxLength(160) email: string;
  @IsString() @MinLength(1) @MaxLength(5000) message: string;
}

class UpdateMessageDto {
  @IsBoolean() read: boolean;
}

@Controller('messages')
export class MessagesController {
  constructor(@InjectRepository(Message) private readonly repo: Repository<Message>) {}

  /** Website contact form. */
  @Public()
  @Post()
  async create(@Body() dto: CreateMessageDto) {
    await this.repo.save(this.repo.create(dto));
    return { success: true };
  }

  @Get()
  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMessageDto) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException();
    row.read = dto.read;
    return this.repo.save(row);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.repo.delete(id);
    return { success: true };
  }
}
