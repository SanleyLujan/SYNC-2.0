import { BadRequestException } from '@nestjs/common';
import sharp = require('sharp');
import { PrivateIdentityStorageService } from './private-identity-storage.service';

describe('armazenamento privado de identidade', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  let service: PrivateIdentityStorageService;
  beforeEach(() => {
    service = new PrivateIdentityStorageService();
    process.env.SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    global.fetch = jest.fn() as any;
  });
  afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv }; });
  it('falha fechado sem configuração, em bucket público e em indisponibilidade', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await service.isAvailable()).toBe(false);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
    (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ public: true }) });
    expect(await service.isAvailable()).toBe(false);
    (fetch as jest.Mock).mockRejectedValue(new Error('network'));
    expect(await service.isAvailable()).toBe(false);
  });
  it('aceita somente bucket explicitamente privado e limita URL a 5 minutos', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ public: false }) });
    expect(await service.isAvailable()).toBe(true);
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ signedURL: '/object/sign/test' }) });
    await service.signedUrl('kyc/test/selfie.jpg', 9999);
    expect(JSON.parse((fetch as jest.Mock).mock.calls[1][1].body).expiresIn).toBe(300);
    expect((fetch as jest.Mock).mock.calls[1][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('explica configuração ausente sem expor credenciais', async () => {
    delete process.env.SUPABASE_URL;
    const result = await service.diagnostics();
    expect(result.code).toBe('missing_config');
    expect(result.message).toContain('SUPABASE_URL');
    expect(JSON.stringify(result)).not.toContain('test-only');
  });
  it.each([
    [404, {}, 'bucket_missing'],
    [400, { message:'Bucket not found' }, 'bucket_missing'],
    [401, {}, 'access_denied'],
    [403, {}, 'access_denied'],
    [500, {}, 'storage_error'],
  ])('diagnostica status HTTP %s', async (status, body, code) => {
    (fetch as jest.Mock).mockResolvedValue({ ok:false, status, json:async () => body });
    expect(await service.diagnostics()).toEqual(expect.objectContaining({ available:false, code }));
  });
  it('recusa bucket público e URL que aponta para um endpoint', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok:true, json:async () => ({ public:true }) });
    expect((await service.diagnostics()).code).toBe('bucket_public');
    process.env.SUPABASE_URL = 'https://example.invalid/storage/v1';
    expect((await service.diagnostics()).code).toBe('invalid_url');
  });
  it('reencoda imagem real removendo EXIF e recusa conteúdo falso', async () => {
    const buffer = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#123456' } })
      .jpeg().withMetadata({ exif: { IFD0: { Artist: 'fictitious-test' } } }).toBuffer();
    const clean = await service.sanitizeImage({ mimetype: 'image/jpeg', buffer } as any);
    expect((await sharp(clean).metadata()).exif).toBeUndefined();
    await expect(service.sanitizeImage({ mimetype:'image/jpeg', buffer: Buffer.from('<script>bad</script>') } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.sanitizeImage({ mimetype:'image/jpeg', buffer: Buffer.alloc(6*1024*1024+1) } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
