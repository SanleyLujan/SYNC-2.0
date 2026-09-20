import { ForbiddenException } from '@nestjs/common';
import { AdminController } from './admin.controller';

describe('AdminController authorization', () => {
  const controller = new AdminController(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it('does not accept a normal authenticated user', async () => {
    await expect(controller.dashboard({ id: 'user-1', isAdmin: false } as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
  it('does not expose identity documents to a normal user', async () => {
    await expect(controller.moderation({ id:'user', isAdmin:false } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.reviewVerification({ id:'user', isAdmin:false } as any, 'request', { decision:'approve' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('reports verification failures without pretending the queue is empty', async () => {
    const admin = new AdminController({} as any, { find: jest.fn().mockResolvedValue([]) } as any,
      {} as any, {} as any, {} as any, {} as any, { find: jest.fn().mockResolvedValue([]) } as any,
      { listPending: jest.fn().mockRejectedValue(new Error('database unavailable')), storageDiagnostics: jest.fn().mockResolvedValue({ available:false, code:'missing_config', message:'Configure o armazenamento' }) } as any,
      {} as any);
    const result = await admin.moderation({ id:'admin', isAdmin:true } as any);
    expect(result.verificationError).toContain('Não foi possível');
    expect(result.verificationStorage.code).toBe('missing_config');
  });
});
