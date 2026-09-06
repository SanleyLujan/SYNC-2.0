import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class PrivateIdentityStorageService {
  private get config() {
    const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const bucket = process.env.SUPABASE_KYC_BUCKET || 'identity-verification';
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
    const { url, bucket } = this.config;
    const response = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
      headers: this.headers(),
    });
    if (!response.ok) throw new ServiceUnavailableException('Bucket privado de verificação indisponível');
    const data: any = await response.json();
    if (data?.public !== false) {
      throw new ServiceUnavailableException('O bucket de documentos precisa estar configurado como privado');
    }
  }

  async sanitizeImage(file: Express.Multer.File): Promise<Buffer> {
    if (!file?.buffer || !/^image\/(jpeg|png|webp)$/i.test(file.mimetype || '')) {
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
    });
    if (!response.ok) throw new ServiceUnavailableException('Falha ao guardar documento no armazenamento privado');
  }

  async signedUrl(path: string, expiresIn = 300): Promise<string> {
    const { url, bucket } = this.config;
    const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${this.objectPath(path)}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: Math.max(60, Math.min(expiresIn, 600)) }),
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
    }).catch(() => null);
    if (!response?.ok) {
      // Nunca silencie a falha: perder as chaves antes de apagar os documentos
      // impediria uma nova tentativa e deixaria dados pessoais órfãos no storage.
      throw new ServiceUnavailableException('Não foi possível apagar os documentos privados');
    }
  }
}
