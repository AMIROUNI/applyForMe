import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Job, JobSchema } from '../jobs/job.schema';
import { JobsModule } from '../jobs/jobs.module';
import { SourcesModule } from '../sources/sources.module';
import { ExtensionModule } from '../extension/extension.module';
import { ExtensionRunController } from './extension-run.controller';
import { IngestController } from './ingest.controller';
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
    ExtensionModule,
  ],
  controllers: [ScraperController, ExtensionRunController, IngestController],
  providers: [ScraperService],
})
export class ScraperModule {}
