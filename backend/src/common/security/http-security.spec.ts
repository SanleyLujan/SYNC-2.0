import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { request } from 'http';
import { configureHttpSecurity } from './http-security';

@Controller()
class ProbeController {
  @Get('ok') ok() { return { ok: true }; }
}
@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('HTTP security headers on actual responses', () => {
  let app: INestApplication;
  let port: number;
  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, { logger: false });
    configureHttpSecurity(app, true);
    await app.listen(0, '127.0.0.1');
    port = app.getHttpServer().address().port;
  });
  afterAll(async () => { await app?.close(); });
  function probe(path: string, headers = {}, body?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, path, method: body ? 'POST' : 'GET', headers }, res => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
      });
      req.on('error', reject);
      req.end(body);
    });
  }
  function secure(res: any) {
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(res.headers['permissions-policy']).toContain('camera=()');
    expect(res.headers['content-security-policy']).not.toContain("'unsafe-inline'");
    expect(res.headers['content-security-policy']).toContain("script-src-attr 'none'");
  }
  it('protects normal 200, conditional 304, missing 404 and malformed JSON 400 responses', async () => {
    const ok = await probe('/ok');
    expect(ok.status).toBe(200);
    secure(ok);
    const cached = await probe('/ok', { 'If-None-Match': ok.headers.etag });
    expect(cached.status).toBe(304);
    secure(cached);
    const missing = await probe('/not-found');
    expect(missing.status).toBe(404);
    secure(missing);
    const malformed = await probe('/ok', { 'Content-Type': 'application/json' }, '{');
    expect(malformed.status).toBe(400);
    secure(malformed);
  });
});
