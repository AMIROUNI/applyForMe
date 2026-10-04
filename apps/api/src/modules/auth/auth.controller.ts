import { Controller, Post, Get, Body, Req, Res, HttpCode, HttpStatus, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ExchangeCodeDto } from './dto/exchange-code.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private auth: AuthService) {}

  @Post('register')
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Post('login')
  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
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
      throw new UnauthorizedException('Refresh token not found');
    }
    const result = await this.auth.refresh(refreshToken);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiCookieAuth('af_rt')
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.af_rt;
    if (refreshToken) {
      await this.auth.logout(refreshToken);
    }
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiCookieAuth('af_rt')
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: { id: string; email: string }) {
    return this.auth.me(user.id);
  }

  @Get('google')
  @Public()
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiResponse({ status: 302, description: 'Redirects to Google consent screen' })
  async googleAuth(@Res() res: Response) {
    const { url, state } = await this.auth.googleAuthUrl();
    res.cookie('af_google_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600_000,
      path: '/',
    });
    return res.redirect(url);
  }

  @Get('google/callback')
  @Public()
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with exchange code' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const { code, state } = req.query;
    const storedState = req.cookies?.af_google_state;
    if (!storedState || storedState !== state) {
      this.logger.warn('Invalid OAuth state');
      return res.redirect(`${this.auth['config']?.get?.('WEB_ORIGIN') ?? 'http://localhost:4200'}/login?error=invalid_state`);
    }
    res.clearCookie('af_google_state', { path: '/' });

    try {
      const { redirectUrl } = await this.auth.googleCallback(code as string, state as string);
      return res.redirect(redirectUrl);
    } catch (err) {
      this.logger.error('Google callback error', err);
      return res.redirect(`${this.auth['config']?.get?.('WEB_ORIGIN') ?? 'http://localhost:4200'}/login?error=oauth_failed`);
    }
  }

  @Post('google/exchange')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange one-time code for tokens' })
  @ApiResponse({ status: 200, description: 'Tokens exchanged successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  async exchangeGoogleCode(@Body() dto: ExchangeCodeDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.exchangeGoogleCode(dto.code);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }

  private setRefreshCookie(res: Response, token: string): void {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('af_rt', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie('af_rt', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  }
}