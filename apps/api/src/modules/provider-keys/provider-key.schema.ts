import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ProviderKeyDocument = ProviderKey & Document;

/**
 * A user-owned provider token (Apify), encrypted at rest with AES-256-GCM.
 * The raw token exists only in request bodies and adapter calls — never in
 * responses, logs, or this collection.
 */
@Schema({ timestamps: true, collection: 'provider_keys' })
export class ProviderKey {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  provider: string;

  @Prop({ required: true })
  encryptedKey: string;

  @Prop({ type: String, default: null })
  lastFour: string | null;

  @Prop({ type: Date, default: null })
  lastVerifiedAt: Date | null;
}

export const ProviderKeySchema = SchemaFactory.createForClass(ProviderKey);

ProviderKeySchema.index({ userId: 1, provider: 1 }, { unique: true });
