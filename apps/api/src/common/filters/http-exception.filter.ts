import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        code = (r.code as string) ?? code;
        if (typeof r.message === 'string') {
          message = r.message;
        } else if (Array.isArray(r.message)) {
          message = (r.message as unknown[]).map((m) => String(m)).join(', ');
        } else {
          message = exception.message;
        }
        details = r.details;
      } else {
        message = exception.message;
      }
      if (status === HttpStatus.BAD_REQUEST && code === 'INTERNAL_SERVER_ERROR') {
        code = 'VALIDATION_ERROR';
      }
      if (status === HttpStatus.TOO_MANY_REQUESTS && code === 'INTERNAL_SERVER_ERROR') {
        code = 'RATE_LIMITED';
      }
      if (status === HttpStatus.UNAUTHORIZED && code === 'INTERNAL_SERVER_ERROR') {
        code = 'UNAUTHORIZED';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(`${request.method} ${request.url} -> ${status} ${code}: ${message}`);

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    });
  }
}