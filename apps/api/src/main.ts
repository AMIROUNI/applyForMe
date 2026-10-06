import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;
  const host = config.get<string>('HOST') ?? '0.0.0.0';
  const prefix = config.get<string>('API_PREFIX') ?? 'api/v1';
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:4200')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.use(helmet());
  app.use(cookieParser());

  // Trust the first proxy hop so rate limiting keys on the real client IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix(prefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port, host);
  console.log(`API running on http://localhost:${port}/${prefix}`);
}

bootstrap().catch(err => {
  console.error('Failed to start API:', err instanceof Error ? err.message : err);
  process.exit(1);
});
