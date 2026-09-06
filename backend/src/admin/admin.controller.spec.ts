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
});
