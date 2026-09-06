import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';

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
    expect(pair.refreshToken).not.toBe('raw-refresh-token');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      familyId: 'family-1',
    }));
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
