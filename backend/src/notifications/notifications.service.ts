import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: string,
  ): Promise<Notification | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'isActive', 'inAppNotificationsEnabled'],
    });
    if (!user || !user.isActive || !user.inAppNotificationsEnabled) return null;
    const notification = this.notificationRepository.create({
      user_id: userId,
      type,
      title,
      body,
      data: data ?? null,
    });
    return this.notificationRepository.save(notification);
  }

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const safePage = Math.max(1, Math.min(page, 1000));
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const skip = (safePage - 1) * safeLimit;

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { user_id: userId },
      order: { createdAt: 'DESC' },
      skip,
      take: safeLimit,
    });

    return {
      data: notifications,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepository.count({
      where: { user_id: userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user_id: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notificacao nao encontrada');
    }

    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<{ affected: number }> {
    const result = await this.notificationRepository.update(
      { user_id: userId, isRead: false },
      { isRead: true },
    );
    return { affected: result.affected ?? 0 };
  }

  async deleteOld(userId: string): Promise<{ deleted: number }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.notificationRepository.delete({
      user_id: userId,
      createdAt: LessThan(thirtyDaysAgo),
    });
    return { deleted: result.affected ?? 0 };
  }

  async getPreferences(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'pushNotificationsEnabled',
        'emailNotificationsEnabled',
        'inAppNotificationsEnabled',
        'themeMode',
      ],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return {
      push: user.pushNotificationsEnabled,
      email: user.emailNotificationsEnabled,
      inApp: user.inAppNotificationsEnabled,
      themeMode: user.themeMode,
    };
  }

  async updatePreferences(
    userId: string,
    preferences: { push?: boolean; email?: boolean; inApp?: boolean },
  ) {
    const update: Partial<User> = {};
    if (typeof preferences.push === 'boolean') update.pushNotificationsEnabled = preferences.push;
    if (typeof preferences.email === 'boolean') update.emailNotificationsEnabled = preferences.email;
    if (typeof preferences.inApp === 'boolean') update.inAppNotificationsEnabled = preferences.inApp;
    if (Object.keys(update).length) await this.userRepository.update(userId, update);
    return this.getPreferences(userId);
  }
}
