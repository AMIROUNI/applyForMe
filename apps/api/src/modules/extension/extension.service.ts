import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type {
  ExtensionDeviceList,
  ExtensionPairingChallenge,
  ExtensionPairRequest,
  ExtensionPairResult,
} from '@agency-apply/shared';
import {
  ExtensionPairingCode,
  ExtensionToken,
  type ExtensionPairingCodeDocument,
  type ExtensionTokenDocument,
} from './extension.schema';

export const PAIRING_TTL_MS = 10 * 60 * 1000;
const PAIRING_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const generateCode = (): string => {
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) code += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length];
  return code;
};

@Injectable()
export class ExtensionService {
  private readonly logger = new Logger(ExtensionService.name);

  constructor(
    @InjectModel(ExtensionToken.name)
    private readonly tokenModel: Model<ExtensionTokenDocument>,
    @InjectModel(ExtensionPairingCode.name)
    private readonly codeModel: Model<ExtensionPairingCodeDocument>
  ) {}

  async createPairingChallenge(userId: string): Promise<ExtensionPairingChallenge> {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    await this.codeModel.create({
      codeHash: sha256(code),
      userId,
      expiresAt,
      consumedAt: null,
    });
    return { code, expiresAt };
  }

  async exchangeCode(dto: ExtensionPairRequest): Promise<ExtensionPairResult> {
    const codeHash = sha256(dto.code.trim().toUpperCase());
    const record = await this.codeModel.findOne({ codeHash, consumedAt: null }).exec();
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'PAIRING_CODE_INVALID',
        message: 'That pairing code is not valid or has expired',
      });
    }

    record.consumedAt = new Date();
    await record.save();

    const token = randomBytes(32).toString('hex');
    const deviceId = randomUUID();
    await this.tokenModel.create({
      userId: record.userId,
      tokenHash: sha256(token),
      deviceId,
      label: dto.label,
      lastUsedAt: null,
      revokedAt: null,
    });
    return { token, deviceId };
  }

  async authenticate(token: string): Promise<{ userId: string; tokenId: string } | null> {
    const doc = await this.tokenModel.findOne({ tokenHash: sha256(token), revokedAt: null }).exec();
    if (!doc) return null;
    doc.lastUsedAt = new Date();
    try {
      await doc.save();
    } catch (error) {
      this.logger.warn(`Could not stamp extension token use: ${errorMessage(error)}`);
    }
    return { userId: doc.userId, tokenId: String(doc._id) };
  }

  async listDevices(userId: string): Promise<ExtensionDeviceList> {
    const docs = await this.tokenModel.find({ userId }).sort({ createdAt: -1 }).exec();
    return {
      devices: docs.map(doc => ({
        id: String(doc._id),
        label: doc.label,
        lastUsedAt: doc.lastUsedAt,
        createdAt: createdAtOf(doc),
        revoked: Boolean(doc.revokedAt),
      })),
    };
  }

  async revokeDevice(userId: string, id: string): Promise<ExtensionDeviceList> {
    const doc = await this.findOwned(userId, id);
    if (!doc.revokedAt) {
      doc.revokedAt = new Date();
      await doc.save();
    }
    return this.listDevices(userId);
  }

  private async findOwned(userId: string, id: string): Promise<ExtensionTokenDocument> {
    let doc: ExtensionTokenDocument | null = null;
    try {
      doc = await this.tokenModel.findOne({ _id: id, userId }).exec();
    } catch {
      doc = null;
    }
    if (!doc) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'EXTENSION_DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }
    return doc;
  }
}

const createdAtOf = (doc: ExtensionTokenDocument): Date | null => {
  const value = (doc as unknown as { createdAt?: Date }).createdAt;
  return value ?? null;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
