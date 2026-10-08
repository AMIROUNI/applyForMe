import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ingestJobsRequestSchema,
  type IngestJobsRequest,
  type IngestJobsResponse,
} from '@agency-apply/shared';
import { ExtensionAuthGuard } from '../extension/extension.guard';
import { ScraperService } from './scraper.service';

@Controller('ingest')
@Public()
@UseGuards(ExtensionAuthGuard)
export class IngestController {
  constructor(private readonly scraper: ScraperService) {}

  @Post('jobs')
  ingest(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(ingestJobsRequestSchema)) body: IngestJobsRequest
  ): Promise<IngestJobsResponse> {
    return this.scraper.ingestJobs(user.id, body);
  }
}
