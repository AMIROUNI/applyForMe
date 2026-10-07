import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProviderKeysModule } from '../provider-keys/provider-keys.module';
import { JobSource, JobSourceSchema } from './source.schema';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: JobSource.name, schema: JobSourceSchema }]),
    ProviderKeysModule,
  ],
  controllers: [SourcesController],
  providers: [SourcesService],
  exports: [SourcesService],
})
export class SourcesModule {}
