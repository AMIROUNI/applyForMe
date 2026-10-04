import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { GoogleService, GoogleProfile } from '../google.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService, private google: GoogleService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['openid', 'email', 'profile'],
      passReqToCallback: true,
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    params: { id_token: string },
    profile: GoogleProfile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      if (!profile.verified_email) {
        return done(new UnauthorizedException('Google email not verified'), false);
      }
      const { user } = await this.google.findOrCreateUser(profile);
      const { token: refreshToken, familyId } = await this.google['tokens']?.mintRefreshToken?.(user._id.toString()) ?? { token: '', familyId: '' };
      done(null, { user, familyId });
    } catch (err) {
      done(err, false);
    }
  }
}