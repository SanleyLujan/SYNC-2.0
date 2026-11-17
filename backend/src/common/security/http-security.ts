import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { createHash } from 'crypto';

export function configureHttpSecurity(app: INestApplication, isProd: boolean) {
  // ===== SECURITY HEADERS =====
  // This host serves the API/media and optional Swagger, not the Expo frontend.
  const hash = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
  const { buildSwaggerHTML } = require('@nestjs/swagger/dist/swagger-ui/swagger-ui');
  const htmlTemplateString = buildSwaggerHTML('/api/docs/');
  const swaggerStyles = [...(htmlTemplateString as string).matchAll(/<style>([\s\S]*?)<\/style>/g)]
    .map(match => hash(match[1]));
  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              scriptSrcAttr: ["'none'"],
              styleSrc: ["'self'", ...swaggerStyles],
              // Only Swagger's fixed, hidden SVG sprite attribute is authorized.
              styleSrcAttr: ["'unsafe-hashes'", hash('position:absolute;width:0;height:0')],
              frameSrc: ['https://accounts.google.com/gsi/'],
              imgSrc: [
                "'self'",
                'data:',
                'blob:',
                'https://images.unsplash.com',
                'https://*.tile.openstreetmap.org',
                'https://cdn.jsdelivr.net',
              ],
              connectSrc: [
                "'self'",
                'https://accounts.google.com/gsi/',
                'https://api.open-meteo.com',
                'https://air-quality-api.open-meteo.com',
                'https://api.sunrise-sunset.org',
                'https://nominatim.openstreetmap.org',
                'https://ipapi.co',
                'https://exp.host',
              ],
              fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
      // Permissions-Policy via header customizado (Helmet 7+ não tem builtin)
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use((req: any, res: any, next: any) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    next();
  });

  // Security headers must also cover malformed/oversized body errors.
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));

}
