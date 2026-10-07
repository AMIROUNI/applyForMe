import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProviderKey, ProviderKeySchema } from './provider-key.schema';
import { ProviderKeysController } from './provider-keys.controller';
import { ProviderKeysService } from './provider-keys.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ProviderKey.name, schema: ProviderKeySchema }])],
  controllers: [ProviderKeysController],
  providers: [ProviderKeysService],
  exports: [ProviderKeysService],
})
export class ProviderKeysModule {}
