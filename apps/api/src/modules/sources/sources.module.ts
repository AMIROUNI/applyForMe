import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiscoveryService } from './discovery.service';
import { LlmService } from './llm.service';
import { JobSource, JobSourceSchema } from './source.schema';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: JobSource.name, schema: JobSourceSchema }])],
  controllers: [SourcesController],
  providers: [SourcesService, LlmService, DiscoveryService],
  exports: [SourcesService],
})
export class SourcesModule {}
