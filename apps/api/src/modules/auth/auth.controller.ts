import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { Throttle } from '@nestjs/throttler';

interface OAuthStateCookie {
  s: string;
  v: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  @Post('register')
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto);
    this.setAuthCookies(res, result.refreshToken, result.accessToken, result.expiresIn);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Post('login')
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    this.setAuthCookies(res, result.refreshToken, result.accessToken, result.expiresIn);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh cookie' })
  @ApiCookieAuth('af_rt')
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.af_rt;
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'NO_REFRESH_TOKEN',
        message: 'Refresh token not found',
      });
    }
    const result = await this.auth.refresh(refreshToken);
    this.setAuthCookies(res, result.refreshToken, result.accessToken, result.expiresIn);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiCookieAuth('af_rt')
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.af_rt;
    if (refreshToken) {
      try {
        await this.auth.logout(refreshToken);
      } catch (err) {
        this.logger.warn(
          `Failed to revoke refresh token on logout: ${err instanceof Error ? err.message : 'unknown'}`
        );
      }
    }
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiCookieAuth('af_at')
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: { id: string; email: string }) {
    return this.auth.me(user.id);
  }

  @Get('google')
  @Public()
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiResponse({ status: 302, description: 'Redirects to Google consent screen' })
  async googleAuth(@Res() res: Response): Promise<void> {
    const { url, state, codeVerifier } = await this.auth.googleAuthUrl();
    const payload: OAuthStateCookie = { s: state, v: codeVerifier };
    res.cookie('af_google_state', JSON.stringify(payload), {
      httpOnly: true,
      secure: this.isProd(),
      sameSite: 'lax',
      maxAge: 600_000,
      path: '/',
    });
    res.redirect(url);
  }

  @Get('google/callback')
  @Public()
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with exchange code' })
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const webOrigin = this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:4200';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const rawCookie = req.cookies?.af_google_state as string | undefined;
    res.clearCookie('af_google_state', { path: '/' });

    if (typeof req.query.error === 'string') {
      this.logger.warn(`Google OAuth error: ${req.query.error}`);
      const code = req.query.error === 'access_denied' ? 'access_denied' : 'oauth_failed';
      res.redirect(`${webOrigin}/login?error=${code}`);
      return;
    }

    let stored: OAuthStateCookie | null = null;
    try {
      stored = rawCookie ? (JSON.parse(rawCookie) as OAuthStateCookie) : null;
    } catch {
      stored = null;
    }

    if (!stored?.s || !state || stored.s !== state) {
      this.logger.warn('Invalid OAuth state');
      res.redirect(`${webOrigin}/login?error=invalid_state`);
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      res.redirect(`${webOrigin}/login?error=oauth_failed`);
      return;
    }

    try {
      const { redirectUrl } = await this.auth.googleCallback(code, stored.v);
      res.redirect(redirectUrl);
    } catch (err) {
      const responseCode =
        err instanceof HttpException ? (err.getResponse() as { code?: string })?.code : undefined;
      const code = responseCode === 'EMAIL_NOT_VERIFIED' ? 'email_not_verified' : 'oauth_failed';
      this.logger.error(`Google callback error: ${err instanceof Error ? err.message : 'unknown'}`);
      res.redirect(`${webOrigin}/login?error=${code}`);
    }
  }

  @Post('google/exchange')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange one-time code for tokens' })
  @ApiResponse({ status: 200, description: 'Tokens exchanged successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  async exchangeGoogleCode(
    @Body() dto: ExchangeCodeDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.auth.exchangeGoogleCode(dto.code);
    this.setAuthCookies(res, result.refreshToken, result.accessToken, result.expiresIn);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  private isProd(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private setAuthCookies(
    res: Response,
    refreshToken: string,
    accessToken: string,
    expiresInSeconds: number
  ): void {
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    res.cookie('af_rt', refreshToken, {
      httpOnly: true,
      secure: this.isProd(),
      sameSite: 'lax',
      maxAge,
      path: '/',
    });
    res.cookie('af_at', accessToken, {
      httpOnly: true,
      secure: this.isProd(),
      sameSite: 'lax',
      maxAge: Math.max(expiresInSeconds, 60) * 1000,
      path: '/',
    });
    // Non-httpOnly marker so the client knows a session may exist and only
    // attempts a silent refresh when it does (no token inside — just a flag).
    res.cookie('af_sid', '1', {
      httpOnly: false,
      secure: this.isProd(),
      sameSite: 'lax',
      maxAge,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response): void {
    const base = {
      secure: this.isProd(),
      sameSite: 'lax' as const,
      path: '/',
    };
    res.clearCookie('af_rt', { ...base, httpOnly: true });
    res.clearCookie('af_at', { ...base, httpOnly: true });
    res.clearCookie('af_sid', { ...base, httpOnly: false });
  }
}
