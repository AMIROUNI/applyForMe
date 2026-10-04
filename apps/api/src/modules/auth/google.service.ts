import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../../users/users.service';

export interface GoogleProfile {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
}

export interface OAuthCodeDoc {
  _id: string;
  codeHash: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class GoogleService {
  private readonly oauthCodeModel: Model<OAuthCodeDoc>;

  constructor(
    private config: ConfigService,
    private users: UsersService,
    @InjectModel('OAuthCode') oauthCodeModel: Model<OAuthCodeDoc>,
  ) {
    this.oauthCodeModel = oauthCodeModel;
  }

  generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      redirect_uri: this.config.get<string>('GOOGLE_CALLBACK_URL') ?? '',
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = new URLSearchParams({
      code,
      client_id: this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      redirect_uri: this.config.get<string>('GOOGLE_CALLBACK_URL') ?? '',
      grant_type: 'authorization_code',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new UnauthorizedException('Failed to exchange Google code');
    }

    const { access_token } = await res.json();

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileRes.ok) {
      throw new UnauthorizedException('Failed to fetch Google profile');
    }

    return profileRes.json();
  }

  async findOrCreateUser(profile: GoogleProfile): Promise<{ user: any; isNew: boolean }> {
    let user = await this.users.findByGoogleId(profile.id);
    if (user) {
      return { user, isNew: false };
    }

    user = await this.users.findByEmail(profile.email);
    if (user) {
      await this.users.linkGoogleId(user._id.toString(), profile.id, profile.picture);
      user.googleId = profile.id;
      user.avatar = profile.picture;
      return { user, isNew: false };
    }

    const newUser = await this.users.create(profile.email, '');
    await this.users.linkGoogleId(newUser._id.toString(), profile.id, profile.picture);
    return { user: newUser, isNew: true };
  }

  async createExchangeCode(userId: string, familyId: string): Promise<string> {
    const code = crypto.randomBytes(24).toString('base64url');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 60_000);

    await this.oauthCodeModel.create({
      codeHash,
      userId,
      familyId,
      expiresAt,
    });

    return code;
  }

  async consumeExchangeCode(code: string): Promise<{ userId: string; familyId: string } | null> {
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const doc = await this.oauthCodeModel.findOne({ codeHash }).exec();

    if (!doc || doc.expiresAt < new Date()) {
      return null;
    }

    await this.oauthCodeModel.deleteOne({ _id: doc._id }).exec();
    return { userId: doc.userId, familyId: doc.familyId };
  }
}