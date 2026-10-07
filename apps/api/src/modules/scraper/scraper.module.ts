import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from '../jobs/job.schema';
import { JobsModule } from '../jobs/jobs.module';
import { ProviderKeysModule } from '../provider-keys/provider-keys.module';
import { SourcesModule } from '../sources/sources.module';
import { ScrapeRun, ScrapeRunSchema } from './run.schema';
import { ScraperController } from './scraper.controller';
import { ScraperService } from './scraper.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScrapeRun.name, schema: ScrapeRunSchema },
      { name: Job.name, schema: JobSchema },
    ]),
    JobsModule,
    SourcesModule,
    ProviderKeysModule,
  ],
  controllers: [ScraperController],
  providers: [ScraperService],
})
export class ScraperModule {}
