import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Schema } from 'mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { GoogleService } from './google.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard';
import { UsersModule } from '../users/users.module';

const RefreshTokenSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true },
    rotated: { type: Boolean, required: true, default: false },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true, collection: 'refresh_tokens' }
);

const OAuthCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true, collection: 'oauth_codes' }
);

const AuthAttemptSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, required: true, default: 1 },
    resetAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true, collection: 'auth_attempts' }
);

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: 'RefreshToken', schema: RefreshTokenSchema },
      { name: 'OAuthCode', schema: OAuthCodeSchema },
      { name: 'AuthAttempt', schema: AuthAttemptSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          issuer: 'agency-apply',
          audience: 'agency-apply-web',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, GoogleService, JwtStrategy, AuthRateLimitGuard],
  exports: [AuthService, TokenService, GoogleService],
})
export class AuthModule {}
