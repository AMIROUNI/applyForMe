import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

interface AuthAttemptDoc {
  _id: string;
  key: string;
  count: number;
  resetAt: Date;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly attemptModel: Model<AuthAttemptDoc>;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(
    config: ConfigService,
    private reflector: Reflector,
    @InjectModel('AuthAttempt') attemptModel: Model<AuthAttemptDoc>
  ) {
    this.attemptModel = attemptModel;
    const [limit, windowMs] = (config.get<string>('AUTH_RATE_LIMIT') ?? '5/60000').split('/');
    this.limit = parseInt(limit, 10) || 5;
    this.windowMs = parseInt(windowMs, 10) || 60_000;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const email = typeof request.body?.email === 'string' ? request.body.email : '';
    const route = typeof request.path === 'string' ? request.path : '';
    const key = `${ip}:${email}:${route}`.toLowerCase();

    const now = new Date();
    const doc = await this.increment(key, now);

    if (doc.count > this.limit) {
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    this.clearOnSuccess(response, key);

    return true;
  }

  private async increment(key: string, now: Date): Promise<AuthAttemptDoc> {
    const active = await this.attemptModel
      .findOneAndUpdate({ key, resetAt: { $gt: now } }, { $inc: { count: 1 } }, { new: true })
      .exec();
    if (active) {
      return active;
    }

    try {
      const fresh = await this.attemptModel
        .findOneAndUpdate(
          { key },
          { $set: { count: 1, resetAt: new Date(now.getTime() + this.windowMs) } },
          { upsert: true, new: true }
        )
        .exec();
      return fresh as AuthAttemptDoc;
    } catch (err) {
      // Concurrent first request for this key won the upsert race; increment it instead.
      if ((err as { code?: number })?.code === 11000) {
        const raced = await this.attemptModel
          .findOneAndUpdate({ key, resetAt: { $gt: now } }, { $inc: { count: 1 } }, { new: true })
          .exec();
        if (raced) return raced;
      }
      throw err;
    }
  }

  private clearOnSuccess(
    response: { on?: (event: string, cb: () => void) => void; statusCode?: number },
    key: string
  ): void {
    if (typeof response?.on !== 'function') return;
    response.on('finish', () => {
      if ((response.statusCode ?? 500) < 400) {
        this.attemptModel
          .deleteOne({ key })
          .exec()
          .catch(() => undefined);
      }
    });
  }
}
