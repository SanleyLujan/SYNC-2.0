import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshToken } from './entities/refresh-token.entity';

describe('RefreshTokenService rotation', () => {
  const queryBuilder = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn(),
  };
  const repo = {
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ ...value, id: 'new-token-id' })),
    createQueryBuilder: jest.fn(() => queryBuilder),
    manager: {} as any,
  };
  const jwt = { sign: jest.fn(() => 'access-token') };
  let service: RefreshTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    queryBuilder.update.mockReturnValue(queryBuilder);
    queryBuilder.set.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.execute.mockResolvedValue({ affected: 1 });
    repo.create.mockImplementation((value) => value);
    repo.save.mockImplementation(async (value) => ({ ...value, id: 'new-token-id' }));
    const manager = { connection: { options: { type: 'postgres' } }, getRepository: (entity: any) => entity === RefreshToken ? repo : { findOne: jest.fn().mockResolvedValue({ id: 'user-1' }) } };
    repo.manager.transaction = jest.fn(fn => fn(manager));
    service = new RefreshTokenService(repo as any, jwt as any);
  });

  it('atomically consumes the current token and emits a rotated pair', async () => {
    repo.findOne.mockResolvedValue({
      id: 'old-token-id',
      userId: 'user-1',
      familyId: 'family-1',
      used: false,
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const pair = await service.refresh(
      'raw-refresh-token',
      async () => ({ id: 'user-1', email: 'user@example.com' } as any),
    );

    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
    expect(pair.accessToken).toBe('access-token');
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sid: 'family-1' }), expect.anything());
    expect(pair.refreshToken).not.toBe('raw-refresh-token');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      familyId: 'family-1',
    }));
  });

  it('recusa access com família revogada e tolera access legado até expirar', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.assertSessionActive('user-1', 'revoked')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.assertSessionActive('user-1')).resolves.toBeUndefined();
  });

  it('recusa refresh expirado sem criar outro token', async () => {
    repo.findOne.mockResolvedValue({ userId: 'user-1', expiresAt: new Date(0) });
    await expect(service.refresh('expired', jest.fn())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('revoga somente a sessão pertencente ao usuário autenticado', async () => {
    await service.revokeSession('user-1', 'someone-elses-family');
    expect(repo.update).toHaveBeenCalledWith({ userId: 'user-1', familyId: 'someone-elses-family' }, { revoked: true });
  });

  it('revokes the complete family when a consumed token is reused', async () => {
    repo.findOne.mockResolvedValue({
      id: 'old-token-id',
      userId: 'user-1',
      familyId: 'family-1',
      used: true,
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.refresh('reused-token', async () => ({ id: 'user-1' } as any)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.update).toHaveBeenCalledWith(
      { familyId: 'family-1' },
      { revoked: true },
    );
  });
});
