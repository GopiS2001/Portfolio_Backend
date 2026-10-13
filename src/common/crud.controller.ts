import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ReorderDto } from '../content/dto/content.dto';
import { SiteService } from '../site/site.service';
import { OrderedEntity } from './base.entity';

const validate = (expectedType: Type) =>
  new ValidationPipe({ expectedType, whitelist: true, forbidNonWhitelisted: true, transform: true });

/**
 * Builds an authenticated CRUD controller for an orderable list entity:
 *   GET    /<path>            list (sorted)
 *   GET    /<path>/:id        one
 *   POST   /<path>            create (appended to the end)
 *   PUT    /<path>/:id        update
 *   PATCH  /<path>/reorder    { ids } -> sortOrder follows array order
 *   DELETE /<path>/:id        remove
 * Every write rebuilds the offline website snapshot.
 */
export function createCrudController<E extends OrderedEntity>(
  path: string,
  entity: Type<E>,
  createDto: Type,
  updateDto: Type,
) {
  @Controller(path)
  class CrudController {
    constructor(
      @Inject(getRepositoryToken(entity)) readonly repo: Repository<E>,
      readonly site: SiteService,
    ) {}

    @Get()
    findAll() {
      return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } as never });
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number) {
      const item = await this.repo.findOneBy({ id } as never);
      if (!item) throw new NotFoundException(`${entity.name} #${id} not found`);
      return item;
    }

    @Post()
    async create(@Body(validate(createDto)) dto: Partial<E>) {
      if (dto.sortOrder === undefined) {
        const last = await this.repo.maximum('sortOrder' as never);
        dto.sortOrder = (Number(last) || 0) + 1;
      }
      const saved = await this.repo.save(this.repo.create(dto as never));
      await this.site.refreshSnapshot();
      return saved;
    }

    @Patch('reorder')
    async reorder(@Body(validate(ReorderDto)) { ids }: ReorderDto) {
      const items = await this.repo.findBy({ id: In(ids) } as never);
      for (const item of items) item.sortOrder = ids.indexOf(item.id) + 1;
      await this.repo.save(items);
      await this.site.refreshSnapshot();
      return this.findAll();
    }

    @Put(':id')
    async update(@Param('id', ParseIntPipe) id: number, @Body(validate(updateDto)) dto: Partial<E>) {
      const item = await this.findOne(id);
      const saved = await this.repo.save(this.repo.merge(item, dto as never));
      await this.site.refreshSnapshot();
      return saved;
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
      const item = await this.findOne(id);
      await this.repo.remove(item);
      await this.site.refreshSnapshot();
      return { success: true };
    }
  }

  Object.defineProperty(CrudController, 'name', { value: `${entity.name}Controller` });
  return CrudController;
}
