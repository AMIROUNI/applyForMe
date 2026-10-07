import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { scraperRunStartSchema } from '@agency-apply/shared';
import type { ScraperRun, ScraperRunStart } from '@agency-apply/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScraperService } from './scraper.service';

@Controller('scraper/runs')
export class ScraperController {
  constructor(private readonly scraper: ScraperService) {}

  @Post()
  start(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(scraperRunStartSchema)) body: ScraperRunStart
  ): Promise<ScraperRun> {
    return this.scraper.startRun(user.id, body);
  }

  @Get(':id')
  getRun(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<ScraperRun> {
    return this.scraper.getRun(user.id, id);
  }
}
