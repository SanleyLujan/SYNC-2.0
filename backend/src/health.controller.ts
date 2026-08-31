import { Controller, Get } from '@nestjs/common';

// Endpoint de healthcheck para Render e monitores de disponibilidade.
@Controller()
export class HealthController {
  @Get('/')
  root() {
    return { ok: true, service: 'sync-api', docs: '/api/docs' };
  }

  @Get('/health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('/api/health')
  apiHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
