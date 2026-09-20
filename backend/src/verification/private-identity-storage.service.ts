import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import sharp = require('sharp');

@Injectable()
export class PrivateIdentityStorageService {
  private get config() {
    const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const bucket = (process.env.SUPABASE_KYC_BUCKET || '').trim() || 'identity-verification';
    if (!url || !key || !bucket) {
      throw new ServiceUnavailableException('Verificação de perfil ainda não foi configurada com armazenamento privado');
    }
    return { url, key, bucket };
  }

  private headers(extra?: Record<string, string>) {
    const { key } = this.config;
    return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
  }

  private objectPath(path: string) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  async assertPrivateBucket(): Promise<void> {
    const status = await this.diagnostics();
    if (!status.available) throw new ServiceUnavailableException('Armazenamento privado de verificação indisponível. A administração precisa verificar a configuração.');
  }

  // Only the administrator endpoint returns these actionable details. Never return keys.
  async diagnostics() {
    const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(name => !process.env[name]?.trim());
    if (missing.length) return { available: false, code: 'missing_config', message: `Configure ${missing.join(' e ')} no Render.` };
    const { url, bucket } = this.config;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.pathname !== '/') {
        return { available: false, code: 'invalid_url', message: 'SUPABASE_URL deve ser a URL base do projeto, sem /storage ou /rest.' };
      }
      const response = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
        headers: this.headers(), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const body: any = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) return { available: false, code: 'access_denied', message: 'Confira a chave service_role do mesmo projeto no Render. A chave anon não serve para documentos privados.' };
        if (response.status === 404 || body?.message === 'Bucket not found' || body?.error === 'Bucket not found') return { available: false, code: 'bucket_missing', message: `Crie o bucket privado "${bucket}" em Supabase → Storage.` };
        return { available: false, code: 'storage_error', message: 'O Supabase não respondeu corretamente. Confira o projeto e o serviço Storage.' };
      }
      const data: any = await response.json();
      if (data?.public !== false) return { available: false, code: 'bucket_public', message: `O bucket "${bucket}" precisa estar privado. Desative Public bucket no Supabase.` };
      return { available: true, code: 'ready', message: 'Armazenamento privado disponível.' };
    } catch {
      return { available: false, code: 'unreachable', message: 'Não foi possível conectar ao Storage. Confira SUPABASE_URL e se o projeto Supabase está ativo.' };
    }
  }

  async isAvailable(): Promise<boolean> {
    return (await this.diagnostics()).available;
  }

  async sanitizeImage(file: Express.Multer.File): Promise<Buffer> {
    if (!file?.buffer || file.buffer.length > 6 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/i.test(file.mimetype || '')) {
      throw new BadRequestException('Envie apenas imagens JPEG, PNG ou WebP');
    }
    try {
      const source = sharp(file.buffer, { failOn: 'error', limitInputPixels: 40_000_000 });
      const metadata = await source.metadata();
      if (!metadata.width || !metadata.height || !['jpeg', 'png', 'webp'].includes(metadata.format || '')) {
        throw new Error('invalid image');
      }
      // Reencodificação remove EXIF, inclusive GPS e dados do aparelho.
      return source.rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    } catch {
      throw new BadRequestException('Uma das imagens é inválida ou não pôde ser processada');
    }
  }

  async upload(path: string, contents: Buffer): Promise<void> {
    const { url, bucket } = this.config;
    const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${this.objectPath(path)}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }),
      body: contents as any,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new ServiceUnavailableException('Falha ao guardar documento no armazenamento privado');
  }

  async signedUrl(path: string, expiresIn = 300): Promise<string> {
    const { url, bucket } = this.config;
    const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${this.objectPath(path)}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: Math.max(60, Math.min(expiresIn, 300)) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new ServiceUnavailableException('Não foi possível abrir o documento privado');
    const data: any = await response.json();
    const signed = data?.signedURL || data?.signedUrl;
    if (!signed) throw new ServiceUnavailableException('URL privada indisponível');
    return signed.startsWith('http') ? signed : `${url}/storage/v1${signed}`;
  }

  async remove(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { url, bucket } = this.config;
    const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: paths }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!response?.ok) {
      // Nunca silencie a falha: perder as chaves antes de apagar os documentos
      // impediria uma nova tentativa e deixaria dados pessoais órfãos no storage.
      throw new ServiceUnavailableException('Não foi possível apagar os documentos privados');
    }
  }
}
