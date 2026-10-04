import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export interface RefreshTokenDoc {
  _id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class TokenService {
  private readonly refreshTokenModel: Model<RefreshTokenDoc>;

  constructor(
    private config: ConfigService,
    private jwt: JwtService,
    @InjectModel('RefreshToken') refreshTokenModel: Model<RefreshTokenDoc>,
  ) {
    this.refreshTokenModel = refreshTokenModel;
  }

  generateAccessToken(userId: string, sessionId: string): string {
    return this.jwt.sign(
      { sub: userId, sid: sessionId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
        issuer: 'agency-apply',
        audience: 'agency-apply-web',
      },
    );
  }

  verifyAccessToken(token: string): { sub: string; sid: string } | null {
    try {
      return this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        issuer: 'agency-apply',
        audience: 'agency-apply-web',
      });
    } catch {
      return null;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async mintRefreshToken(userId: string, familyId?: string): Promise<{ token: string; familyId: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const ttlDays = parseInt(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d', 10) || 30;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const newFamilyId = familyId ?? crypto.randomBytes(16).toString('hex');

    await this.refreshTokenModel.create({
      userId,
      familyId: newFamilyId,
      tokenHash,
      expiresAt,
    });

    return { token, familyId: newFamilyId, expiresAt };
  }

  async rotateRefreshToken(presentedToken: string, userId: string): Promise<{ accessToken: string; refreshToken: string; familyId: string } | null> {
    const presentedHash = this.hashToken(presentedToken);
    const stored = await this.refreshTokenModel.findOne({ userId, tokenHash: presentedHash }).exec();

    if (!stored || stored.expiresAt < new Date()) {
      return null;
    }

    if (stored.tokenHash !== presentedHash) {
      await this.revokeFamily(stored.familyId);
      return null;
    }

    await this.refreshTokenModel.deleteOne({ _id: stored._id }).exec();

    const { token: newRefreshToken, familyId } = await this.mintRefreshToken(userId, stored.familyId);
    const accessToken = this.generateAccessToken(userId, familyId);

    return { accessToken, refreshToken: newRefreshToken, familyId };
  }

  async revokeRefreshToken(token: string, userId: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.refreshTokenModel.deleteOne({ userId, tokenHash }).exec();
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.refreshTokenModel.deleteMany({ familyId }).exec();
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenModel.deleteMany({ userId }).exec();
  }
}