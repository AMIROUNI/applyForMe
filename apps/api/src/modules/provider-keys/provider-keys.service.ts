import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import type { ProviderKeyInfo, ProviderKind } from '@agency-apply/shared';
import { fetchJson } from '../scraper/http';
import { decryptSecret, encryptSecret } from './crypto';
import { ProviderKey, type ProviderKeyDocument } from './provider-key.schema';

const PROVIDERS: readonly ProviderKind[] = ['apify'];
const VERIFY_TIMEOUT_MS = 10_000;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

@Injectable()
export class ProviderKeysService {
  private readonly logger = new Logger(ProviderKeysService.name);

  constructor(
    @InjectModel(ProviderKey.name) private readonly keyModel: Model<ProviderKeyDocument>,
    private readonly config: ConfigService
  ) {}

  /** Connected state per supported provider — masked, never the raw token. */
  async list(userId: string): Promise<ProviderKeyInfo[]> {
    const docs = await this.keyModel.find({ userId }).exec();
    const byProvider = new Map(docs.map(doc => [doc.provider, doc]));
    return PROVIDERS.map(provider => {
      const doc = byProvider.get(provider);
      return {
        provider,
        connected: Boolean(doc),
        lastFour: doc?.lastFour ?? null,
        lastVerifiedAt: doc?.lastVerifiedAt ?? null,
      };
    });
  }

  /** Decrypted token for adapter contexts; null when absent or unreadable. */
  async getDecrypted(userId: string, provider: string): Promise<string | null> {
    const doc = await this.keyModel.findOne({ userId, provider }).exec();
    if (!doc) return null;
    try {
      return decryptSecret(doc.encryptedKey, this.keyMaterial());
    } catch (error) {
      // Never log the payload or the key — just that this row is unreadable.
      this.logger.error(`Stored ${provider} key for this user could not be decrypted`);
      void error;
      return null;
    }
  }

  async set(userId: string, provider: ProviderKind, token: string): Promise<ProviderKeyInfo> {
    const encryptedKey = encryptSecret(token, this.keyMaterial());
    const lastFour = token.slice(-4);
    const now = new Date();
    await this.keyModel
      .findOneAndUpdate(
        { userId, provider },
        {
          $set: { encryptedKey, lastFour, lastVerifiedAt: now },
          $setOnInsert: { userId, provider },
        },
        { upsert: true }
      )
      .exec();
    return { provider, connected: true, lastFour, lastVerifiedAt: now };
  }

  async remove(userId: string, provider: string): Promise<boolean> {
    const result = await this.keyModel.deleteOne({ userId, provider }).exec();
    return (result.deletedCount ?? 0) > 0;
  }

  /**
   * Asks the provider whether the token works before we store it. The token
   * travels in the Authorization header only — never in the URL.
   */
  async verify(provider: ProviderKind, token: string): Promise<void> {
    if (provider !== 'apify') {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PROVIDER_UNKNOWN',
        message: `Unknown provider "${provider}"`,
      });
    }
    try {
      await fetchJson('https://api.apify.com/v2/users/me', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
    } catch (error) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PROVIDER_TOKEN_INVALID',
        message: `Apify rejected the token: ${errorMessage(error)}`,
      });
    }
  }

  private keyMaterial(): string {
    const material = this.config.get<string>('ENCRYPTION_KEY');
    if (!material) {
      throw new Error('ENCRYPTION_KEY is not configured');
    }
    return material;
  }
}
