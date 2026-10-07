import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createSourceSchema,
  discoverSourcesSchema,
  sourceListQuerySchema,
  updateSourceSchema,
} from '@agency-apply/shared';
import type {
  CreateSource,
  DiscoverResult,
  DiscoverSources,
  JobSource,
  SourceListQuery,
  SourceValidateResult,
  UpdateSource,
} from '@agency-apply/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DiscoveryService } from './discovery.service';
import { SourcesService } from './sources.service';

@Controller('sources')
export class SourcesController {
  constructor(
    private readonly sources: SourcesService,
    private readonly discovery: DiscoveryService
  ) {}

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

  /** AI proposes candidates; only deterministically validated ones are added. */
  @Post('discover')
  discover(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(discoverSourcesSchema)) body: DiscoverSources
  ): Promise<DiscoverResult> {
    return this.discovery.discover(user.id, body);
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
