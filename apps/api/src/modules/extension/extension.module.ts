import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExtensionController } from './extension.controller';
import { ExtensionAuthGuard } from './extension.guard';
import { ExtensionService } from './extension.service';
import {
  ExtensionPairingCode,
  ExtensionPairingCodeSchema,
  ExtensionToken,
  ExtensionTokenSchema,
} from './extension.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExtensionToken.name, schema: ExtensionTokenSchema },
      { name: ExtensionPairingCode.name, schema: ExtensionPairingCodeSchema },
    ]),
  ],
  controllers: [ExtensionController],
  providers: [ExtensionService, ExtensionAuthGuard],
  exports: [ExtensionService, ExtensionAuthGuard],
})
export class ExtensionModule {}
