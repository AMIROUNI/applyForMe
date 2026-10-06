import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import * as crypto from 'crypto';

export interface RefreshTokenDoc {
  _id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  rotated: boolean;
  expiresAt: Date;
  createdAt?: Date;
}

export interface JwtPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    @InjectModel('RefreshToken') private readonly refreshTokenModel: Model<RefreshTokenDoc>
  ) {}

  generateAccessToken(userId: string, sessionId: string): string {
    return this.jwt.sign(
      { sub: userId, sid: sessionId },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
        issuer: 'agency-apply',
        audience: 'agency-apply-web',
      }
    );
  }

  verifyAccessToken(token: string): JwtPayload | null {
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        issuer: 'agency-apply',
        audience: 'agency-apply-web',
      });
      if (!payload?.sub) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private refreshTtlMs(): number {
    const raw = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
    const days = parseInt(raw, 10) || 30;
    return days * 24 * 60 * 60 * 1000;
  }

  async mintRefreshToken(
    userId: string,
    familyId?: string
  ): Promise<{ token: string; familyId: string }> {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const family = familyId ?? crypto.randomBytes(16).toString('hex');

    await this.refreshTokenModel.create({
      userId,
      familyId: family,
      tokenHash,
      rotated: false,
      expiresAt: new Date(Date.now() + this.refreshTtlMs()),
    });

    return { token, familyId: family };
  }

  async rotateRefreshToken(
    presentedToken: string
  ): Promise<{ userId: string; accessToken: string; refreshToken: string } | null> {
    const presentedHash = this.hashToken(presentedToken);
    const stored = await this.refreshTokenModel.findOne({ tokenHash: presentedHash }).exec();

    if (!stored) return null;

    if (stored.rotated || stored.expiresAt < new Date()) {
      await this.revokeFamily(stored.familyId);
      return null;
    }

    stored.rotated = true;
    await stored.save();

    const { token: newRefreshToken } = await this.mintRefreshToken(stored.userId, stored.familyId);
    const accessToken = this.generateAccessToken(stored.userId, stored.familyId);

    return { userId: stored.userId, accessToken, refreshToken: newRefreshToken };
  }

  async revokeRefreshToken(presentedToken: string): Promise<void> {
    const tokenHash = this.hashToken(presentedToken);
    await this.refreshTokenModel.deleteOne({ tokenHash }).exec();
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.refreshTokenModel.deleteMany({ familyId }).exec();
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenModel.deleteMany({ userId }).exec();
  }
}
