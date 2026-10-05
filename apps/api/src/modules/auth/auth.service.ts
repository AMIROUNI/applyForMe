import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/user.schema';
import { TokenService } from './token.service';
import { GoogleService } from './google.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface AuthResult {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  user: { id: string; email: string; createdAt: Date };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly google: GoogleService,
  ) {}

  get webOrigin(): string {
    return this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:4200';
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await this.users.hashPassword(dto.password);
    const user = await this.users.create(dto.email, passwordHash);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !user.passwordHash || !(await this.users.validatePassword(user, dto.password))) {
      await this.fakeDelay();
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const result = await this.tokens.rotateRefreshToken(refreshToken);
    if (!result) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token' });
    }
    const user = await this.users.findById(result.userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return {
      accessToken: result.accessToken,
      expiresIn: this.accessTtlSeconds(),
      refreshToken: result.refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken);
  }

  async me(userId: string): Promise<{ id: string; email: string; createdAt: Date }> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return this.sanitizeUser(user);
  }

  async googleAuthUrl(): Promise<{ url: string; state: string; codeVerifier: string }> {
    const state = this.google.generateState();
    const codeVerifier = this.google.generateCodeVerifier();
    const codeChallenge = this.google.computeCodeChallenge(codeVerifier);
    return { url: this.google.getAuthUrl(state, codeChallenge), state, codeVerifier };
  }

  async googleCallback(code: string, codeVerifier?: string): Promise<{ redirectUrl: string }> {
    const profile = await this.google.exchangeCodeForProfile(code, codeVerifier);
    if (!profile.emailVerified) {
      throw new UnauthorizedException({ code: 'EMAIL_NOT_VERIFIED', message: 'Google email not verified' });
    }
    const { user } = await this.google.findOrCreateUser(profile);
    const exchangeCode = await this.google.createExchangeCode(user._id.toString());
    return { redirectUrl: `${this.webOrigin}/auth/callback?code=${exchangeCode}` };
  }

  async exchangeGoogleCode(code: string): Promise<AuthResult> {
    const consumed = await this.google.consumeExchangeCode(code);
    if (!consumed) {
      throw new UnauthorizedException({ code: 'INVALID_EXCHANGE_CODE', message: 'Invalid or expired exchange code' });
    }
    const { token: refreshToken, familyId } = await this.tokens.mintRefreshToken(consumed.userId);
    const accessToken = this.tokens.generateAccessToken(consumed.userId, familyId);
    const user = await this.users.findById(consumed.userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    return {
      accessToken,
      expiresIn: this.accessTtlSeconds(),
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  private async issueTokens(user: UserDocument): Promise<AuthResult> {
    const userId = user._id.toString();
    const { token: refreshToken, familyId } = await this.tokens.mintRefreshToken(userId);
    const accessToken = this.tokens.generateAccessToken(userId, familyId);
    return {
      accessToken,
      expiresIn: this.accessTtlSeconds(),
      refreshToken,
      user: this.sanitizeUser(user),
    };
  }

  private accessTtlSeconds(): number {
    const raw = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const minutes = parseInt(raw, 10) || 15;
    return minutes * 60;
  }

  private sanitizeUser(user: UserDocument): { id: string; email: string; createdAt: Date } {
    return {
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt ?? new Date(0),
    };
  }

  private async fakeDelay(): Promise<void> {
    await new Promise((r) => setTimeout(r, 100));
  }
}