import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req?.cookies?.af_at,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
      issuer: 'agency-apply',
      audience: 'agency-apply-web',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: { sub: string; sid: string }) {
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    req.user = { id: payload.sub, email: user.email, sessionId: payload.sid };
    return req.user;
  }
}