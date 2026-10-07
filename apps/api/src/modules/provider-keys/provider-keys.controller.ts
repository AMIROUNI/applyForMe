import { BadRequestException, Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { providerKeyPutSchema } from '@agency-apply/shared';
import type {
  ProviderKeyInfo,
  ProviderKeyPut,
  ProviderKeyRemoveResult,
  ProviderKind,
} from '@agency-apply/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProviderKeysService } from './provider-keys.service';

const assertProvider = (value: string): ProviderKind => {
  if (value === 'apify') return value;
  throw new BadRequestException({
    statusCode: 400,
    code: 'PROVIDER_UNKNOWN',
    message: `Unknown provider "${value}"`,
  });
};

@Controller('provider-keys')
export class ProviderKeysController {
  constructor(private readonly keys: ProviderKeysService) {}

  @Get()
  list(@CurrentUser() user: { id: string }): Promise<ProviderKeyInfo[]> {
    return this.keys.list(user.id);
  }

  /** Verify-then-store: the token is only persisted after Apify accepts it. */
  @Put(':provider')
  async connect(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Body(new ZodValidationPipe(providerKeyPutSchema)) body: ProviderKeyPut
  ): Promise<ProviderKeyInfo> {
    const kind = assertProvider(provider);
    await this.keys.verify(kind, body.token);
    return this.keys.set(user.id, kind, body.token);
  }

  @Delete(':provider')
  disconnect(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string
  ): Promise<ProviderKeyRemoveResult> {
    const kind = assertProvider(provider);
    return this.keys.remove(user.id, kind).then(removed => ({ removed }));
  }
}
