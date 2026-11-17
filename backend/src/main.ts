import { configureHttpSecurity } from './common/security/http-security';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { initSentry } from './common/sentry/sentry.init';
import { SentryExceptionFilter } from './common/sentry/sentry.filter';

// Inicializa Sentry o mais cedo possível (no-op se SENTRY_DSN não estiver setado)
const sentry = initSentry();

// Lazy require — pkg pode não estar instalado em dev/local
let basicAuth: any;
try { basicAuth = require('express-basic-auth'); } catch {}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  if (sentry.enabled) logger.log('Sentry error tracking ENABLED');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  // Global exception filter — captura 5xx → Sentry, mantém formato de resposta
  app.useGlobalFilters(new SentryExceptionFilter());

  const isProd = process.env.NODE_ENV === 'production';

  configureHttpSecurity(app, isProd);

  // ===== VALIDAÇÃO GLOBAL =====
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // ===== CORS estrito =====
  // Domínios permitidos vêm de FRONTEND_URL (csv: prod1.com,prod2.com)
  // Fora dev, NÃO usa wildcard regex de subdomínio Vercel — exige domínio explícito.
  const frontendUrls = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Em dev: aceita qualquer origin (Expo dev server muda porta)
      if (!isProd) return callback(null, true);
      // Sem origin (apps nativos, curl) → permitir
      if (!origin) return callback(null, true);
      // Match exato com lista
      if (frontendUrls.includes(origin)) return callback(null, true);
      // Bloqueia o resto SEM lançar erro (evita 500 no preflight);
      // só não envia os headers CORS, o navegador bloqueia naturalmente.
      logger.warn(`CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: false,
    maxAge: 86400,
  });

  // Render termina o TLS e encaminha o protocolo original pelos headers do proxy.
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp?.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  // ===== SWAGGER — protegido em prod =====
  if (!isProd || process.env.SWAGGER_USER) {
    if (isProd && process.env.SWAGGER_USER && process.env.SWAGGER_PASS && basicAuth) {
      app.use(
        ['/api/docs', '/api/docs-json'],
        basicAuth({
          challenge: true,
          users: { [process.env.SWAGGER_USER]: process.env.SWAGGER_PASS },
        }),
      );
    }
    const config = new DocumentBuilder()
      .setTitle('Sync API')
      .setDescription('API do aplicativo Sync')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs: /api/docs');
  } else {
    logger.log('Swagger desativado em produção (defina SWAGGER_USER/PASS para habilitar com basic auth)');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Sync API running on port ${port} (env=${process.env.NODE_ENV || 'dev'})`);
}

bootstrap();
