import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { TokenService } from './token.service';
import { GoogleService } from './google.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private config: ConfigService,
    private users: UsersService,
    private tokens: TokenService,
    private google: GoogleService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await this.users.hashPassword(dto.password);
    const user = await this.users.create(dto.email, passwordHash);
    const { token: refreshToken, familyId } = await this.tokens.mintRefreshToken(user._id.toString());
    const accessToken = this.tokens.generateAccessToken(user._id.toString(), familyId);
    return { accessToken, expiresIn: 900, refreshToken, user: this.sanitizeUser(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await this.users.validatePassword(user, dto.password))) {
      await this.delay();
      throw new UnauthorizedException('Invalid credentials');
    }
    const { token: refreshToken, familyId } = await this.tokens.mintRefreshToken(user._id.toString());
    const accessToken = this.tokens.generateAccessToken(user._id.toString(), familyId);
    return { accessToken, expiresIn: 900, refreshToken, user: this.sanitizeUser(user) };
  }

  async refresh(refreshToken: string) {
    const result = await this.tokens.rotateRefreshToken(refreshToken, '');
    if (!result) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.users.findById(result.familyId);
    if (!user) {
      await this.tokens.revokeFamily(result.familyId);
      throw new UnauthorizedException('User not found');
    }
    return { accessToken: result.accessToken, expiresIn: 900, refreshToken: result.refreshToken, user: this.sanitizeUser(user) };
  }

  async logout(refreshToken: string) {
    await this.tokens.revokeRefreshToken(refreshToken, '');
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async googleAuthUrl(): Promise<{ url: string; state: string }> {
    const state = this.google.generateState();
    const url = this.google.getAuthUrl(state);
    return { url, state };
  }

  async googleCallback(code: string, state: string): Promise<{ redirectUrl: string }> {
    const profile = await this.google.exchangeCodeForProfile(code);
    if (!profile.verified_email) {
      throw new UnauthorizedException('Google email not verified');
    }
    const { user, isNew } = await this.google.findOrCreateUser(profile);
    const { token: refreshToken, familyId } = await this.tokens.mintRefreshToken(user._id.toString());
    const exchangeCode = await this.google.createExchangeCode(user._id.toString(), familyId);
    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:4200';
    const redirectUrl = `${webOrigin}/auth/callback?code=${exchangeCode}`;
    return { redirectUrl };
  }

  async exchangeGoogleCode(code: string) {
    const consumed = await this.google.consumeExchangeCode(code);
    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired exchange code');
    }
    const { token: refreshToken, familyId } = await this.tokens.mintRefreshToken(consumed.userId, consumed.familyId);
    const accessToken = this.tokens.generateAccessToken(consumed.userId, familyId);
    const user = await this.users.findById(consumed.userId);
    return { accessToken, expiresIn: 900, refreshToken, user: this.sanitizeUser(user!) };
  }

  private sanitizeUser(user: any) {
    return { id: user._id.toString(), email: user.email, createdAt: user.createdAt };
  }

  private async delay(): Promise<void> {
    await new Promise((r) => setTimeout(r, 100));
  }
}