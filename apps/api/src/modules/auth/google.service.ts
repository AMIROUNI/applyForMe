import { Injectable, Logger, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/user.schema';

export interface GoogleProfile {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
}

export interface OAuthCodeDoc {
  _id: string;
  codeHash: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);
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

  generateCodeVerifier(): string {
    return crypto.randomBytes(48).toString('base64url');
  }

  computeCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  getAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.requireCredential('GOOGLE_CLIENT_ID'),
      redirect_uri: this.requireCredential('GOOGLE_CALLBACK_URL'),
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForProfile(code: string, codeVerifier?: string): Promise<GoogleProfile> {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = new URLSearchParams({
      code,
      client_id: this.requireCredential('GOOGLE_CLIENT_ID'),
      client_secret: this.requireCredential('GOOGLE_CLIENT_SECRET'),
      redirect_uri: this.requireCredential('GOOGLE_CALLBACK_URL'),
      grant_type: 'authorization_code',
    });
    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new UnauthorizedException({ code: 'GOOGLE_CODE_EXCHANGE_FAILED', message: 'Failed to exchange Google code' });
    }

    const { access_token } = (await res.json()) as { access_token?: string };
    if (!access_token) {
      throw new UnauthorizedException({ code: 'GOOGLE_CODE_EXCHANGE_FAILED', message: 'Failed to exchange Google code' });
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileRes.ok) {
      throw new UnauthorizedException({ code: 'GOOGLE_PROFILE_FETCH_FAILED', message: 'Failed to fetch Google profile' });
    }

    const raw = (await profileRes.json()) as Record<string, unknown>;
    const id = raw['sub'] ?? raw['id'];
    const email = raw['email'];
    if (typeof id !== 'string' || typeof email !== 'string' || !id || !email) {
      throw new UnauthorizedException({ code: 'GOOGLE_PROFILE_FETCH_FAILED', message: 'Failed to fetch Google profile' });
    }

    // Google's OIDC userinfo (v3) returns `email_verified`; the legacy v2
    // endpoint returns `verified_email`. Accept both shapes.
    const verifiedRaw = raw['email_verified'] ?? raw['verified_email'];

    return {
      id,
      email,
      emailVerified: verifiedRaw === true || verifiedRaw === 'true',
      name: typeof raw['name'] === 'string' ? raw['name'] : '',
      picture: typeof raw['picture'] === 'string' ? raw['picture'] : '',
    };
  }

  async findOrCreateUser(profile: GoogleProfile): Promise<{ user: UserDocument; isNew: boolean }> {
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

  async createExchangeCode(userId: string): Promise<string> {
    const code = crypto.randomBytes(24).toString('base64url');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 60_000);

    await this.oauthCodeModel.create({
      codeHash,
      userId,
      expiresAt,
    });

    return code;
  }

  async consumeExchangeCode(code: string): Promise<{ userId: string } | null> {
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const doc = await this.oauthCodeModel
      .findOneAndDelete({ codeHash, expiresAt: { $gt: new Date() } })
      .exec();

    if (!doc) {
      return null;
    }

    return { userId: doc.userId };
  }

  private requireCredential(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      this.logger.error(`Missing required Google OAuth configuration: ${key}`);
      throw new InternalServerErrorException({
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'Google OAuth is not configured',
      });
    }
    return value;
  }
}
