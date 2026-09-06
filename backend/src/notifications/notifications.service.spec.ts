import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';

describe('NotificationsService preferences', () => {
  const notifications = { create: jest.fn((value) => value), save: jest.fn((value) => value) };
  const users = { findOne: jest.fn(), update: jest.fn() };
  const service = new NotificationsService(notifications as any, users as any);

  beforeEach(() => jest.clearAllMocks());

  it('does not persist an in-app notification when the user disabled it', async () => {
    users.findOne.mockResolvedValue({ id: 'u1', isActive: true, inAppNotificationsEnabled: false });
    await expect(service.create('u1', NotificationType.NEW_MESSAGE, 'Título', 'Corpo')).resolves.toBeNull();
    expect(notifications.save).not.toHaveBeenCalled();
  });

  it('does not notify a deactivated account', async () => {
    users.findOne.mockResolvedValue({ id: 'u1', isActive: false, inAppNotificationsEnabled: true });
    await expect(service.create('u1', NotificationType.NEW_MESSAGE, 'Título', 'Corpo')).resolves.toBeNull();
    expect(notifications.save).not.toHaveBeenCalled();
  });
});
