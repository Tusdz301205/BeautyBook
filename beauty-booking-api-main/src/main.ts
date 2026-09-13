import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import compression from 'compression';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

export function assertSafeProductionSecrets(config: ConfigService): void {
  if (config.get<string>('NODE_ENV') !== 'production') return;
  const secrets = [
    ['JWT_SECRET', config.get<string>('JWT_SECRET')],
    ['JWT_REFRESH_SECRET', config.get<string>('JWT_REFRESH_SECRET')],
  ] as const;
  const unsafe = /change-me|local-development|default|example|secret/i;
  for (const [name, value] of secrets) {
    if (!value || value.length < 32 || unsafe.test(value)) {
      throw new Error(`${name} must be a non-default secret of at least 32 characters in production`);
    }
  }
  const encryptionKey = config.get<string>('SENSITIVE_DATA_ENCRYPTION_KEY');
  if (!encryptionKey || Buffer.from(encryptionKey, 'base64').length !== 32) {
    throw new Error('SENSITIVE_DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key in production');
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  assertSafeProductionSecrets(config);

  const trustProxyHops = Number(config.get('TRUST_PROXY_HOPS') ?? 1);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5');
  }
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);

  app.use(json({ limit: config.get<string>('JSON_BODY_LIMIT') ?? '1mb' }));
  app.use(
    urlencoded({
      extended: true,
      limit: config.get<string>('FORM_BODY_LIMIT') ?? '1mb',
    }),
  );
  app.use((request, response, next) => {
    const incoming = request.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming)
        ? incoming
        : randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  });
  app.use(helmet());
  app.use(compression());

  // CORS allowlist from env
  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (config.get<string>('NODE_ENV') === 'production' && corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS must not contain "*" in production');
  }

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global validation pipe — reject unknown fields, auto-transform types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Global API prefix — API Rule 7: chuẩn giao tiếp /api/v1/
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  Logger.log(`API running on http://localhost:${port}/api/v1`, 'Bootstrap');
}
if (require.main === module) {
  void bootstrap();
}
