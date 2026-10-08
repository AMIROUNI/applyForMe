import type { ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { ExtensionService } from './extension.service';

type ExtensionRequest = Request & { user?: unknown };

@Injectable()
export class ExtensionAuthGuard {
  constructor(private readonly extension: ExtensionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ExtensionRequest>();
    const token = extractToken(request);
    if (!token) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'EXTENSION_TOKEN_MISSING',
        message: 'An extension token is required',
      });
    }
    const auth = await this.extension.authenticate(token);
    if (!auth) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: 'EXTENSION_TOKEN_INVALID',
        message: 'This extension token is not valid',
      });
    }
    request.user = { id: auth.userId, extensionTokenId: auth.tokenId };
    return true;
  }
}

const extractToken = (request: ExtensionRequest): string => {
  const header = request.headers['authorization'];
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    const bearer = header.slice(7).trim();
    if (bearer) return bearer;
  }
  const custom = request.headers['x-extension-token'];
  if (typeof custom === 'string' && custom.trim()) return custom.trim();
  return '';
};
