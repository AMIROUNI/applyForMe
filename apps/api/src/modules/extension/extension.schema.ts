import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ExtensionTokenDocument = ExtensionToken & Document;
export type ExtensionPairingCodeDocument = ExtensionPairingCode & Document;

@Schema({ timestamps: true, collection: 'extension_tokens' })
export class ExtensionToken {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ required: true })
  deviceId: string;

  @Prop({ default: 'Browser extension' })
  label: string;

  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;
}

export const ExtensionTokenSchema = SchemaFactory.createForClass(ExtensionToken);

@Schema({ timestamps: true, collection: 'extension_pairing_codes' })
export class ExtensionPairingCode {
  @Prop({ required: true, unique: true })
  codeHash: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  consumedAt: Date | null;
}

export const ExtensionPairingCodeSchema = SchemaFactory.createForClass(ExtensionPairingCode);
