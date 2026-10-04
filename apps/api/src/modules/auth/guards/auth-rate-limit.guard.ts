import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, TooManyRequestsException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';

interface AuthAttemptDoc {
  _id: string;
  key: string;
  count: number;
  resetAt: Date;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly attemptModel: Model<AuthAttemptDoc>;

  constructor(
    private config: ConfigService,
    private reflector: Reflector,
    @InjectModel('AuthAttempt') attemptModel: Model<AuthAttemptDoc>,
  ) {
    this.attemptModel = attemptModel;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const ip = request.ip ?? request.connection?.remoteAddress ?? 'unknown';
    const email = request.body?.email ?? '';
    const key = `${ip}:${email}`.toLowerCase();

    const limit = 5;
    const windowMs = 60_000;

    const now = new Date();
    let doc = await this.attemptModel.findOne({ key }).exec();

    if (!doc || doc.resetAt < now) {
      doc = new this.attemptModel({ key, count: 1, resetAt: new Date(now.getTime() + windowMs) });
    } else {
      doc.count += 1;
    }

    await doc.save();

    if (doc.count > limit) {
      const retryAfter = Math.ceil((doc.resetAt.getTime() - now.getTime()) / 1000);
      throw new TooManyRequestsException('Too many login attempts, please try again later');
    }

    return true;
  }
}