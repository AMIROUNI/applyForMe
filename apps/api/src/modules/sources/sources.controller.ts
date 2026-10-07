import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createSourceSchema,
  sourceListQuerySchema,
  updateSourceSchema,
} from '@agency-apply/shared';
import type {
  CreateSource,
  JobSource,
  SourceListQuery,
  SourceValidateResult,
  UpdateSource,
} from '@agency-apply/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SourcesService } from './sources.service';

@Controller('sources')
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(sourceListQuerySchema)) query: SourceListQuery
  ): Promise<JobSource[]> {
    return this.sources.list(query);
  }

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(createSourceSchema)) body: CreateSource
  ): Promise<JobSource> {
    return this.sources.create(user.id, body);
  }

  @Patch(':id')
  patch(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSourceSchema)) body: UpdateSource
  ): Promise<JobSource> {
    return this.sources.patch(user.id, id, body);
  }

  @Post(':id/validate')
  validate(
    @CurrentUser() user: { id: string },
    @Param('id') id: string
  ): Promise<SourceValidateResult> {
    return this.sources.validate(user.id, id);
  }
}
