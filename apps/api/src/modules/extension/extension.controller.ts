import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  extensionPairRequestSchema,
  type ExtensionDeviceList,
  type ExtensionPairingChallenge,
  type ExtensionPairRequest,
  type ExtensionPairResult,
} from '@agency-apply/shared';
import { ExtensionService } from './extension.service';

@Controller('extension')
export class ExtensionController {
  constructor(private readonly extension: ExtensionService) {}

  @Post('pairing')
  createPairingChallenge(@CurrentUser() user: { id: string }): Promise<ExtensionPairingChallenge> {
    return this.extension.createPairingChallenge(user.id);
  }

  @Post('pair')
  @Public()
  pair(
    @Body(new ZodValidationPipe(extensionPairRequestSchema)) body: ExtensionPairRequest
  ): Promise<ExtensionPairResult> {
    return this.extension.exchangeCode(body);
  }

  @Get('devices')
  listDevices(@CurrentUser() user: { id: string }): Promise<ExtensionDeviceList> {
    return this.extension.listDevices(user.id);
  }

  @Delete('devices/:id')
  revokeDevice(
    @CurrentUser() user: { id: string },
    @Param('id') id: string
  ): Promise<ExtensionDeviceList> {
    return this.extension.revokeDevice(user.id, id);
  }
}
