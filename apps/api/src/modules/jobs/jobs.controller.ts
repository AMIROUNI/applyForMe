import { Body, Controller, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { jobSearchRequestSchema } from '@agency-apply/shared';
import type { JobSearchRequest, JobSearchResponse } from '@agency-apply/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('search')
  search(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(jobSearchRequestSchema)) body: JobSearchRequest
  ): Promise<JobSearchResponse> {
    return this.jobs.search(user.id, body);
  }
}
