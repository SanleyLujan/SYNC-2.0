import { Controller, Get, UseGuards, ForbiddenException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UserReport } from '../users/entities/user-report.entity';
import { Feedback } from '../feedback/feedback.entity';
import { Activity } from '../activities/entities/activity.entity';
import { ActivityFeedPost } from '../activity-feed/activity-feed.entity';
import { Message } from '../chat/entities/message.entity';

@ApiTags('Admin')
@Controller('api/admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserReport) private readonly reports: Repository<UserReport>,
    @InjectRepository(Feedback) private readonly feedback: Repository<Feedback>,
    @InjectRepository(Activity) private readonly activities: Repository<Activity>,
    @InjectRepository(ActivityFeedPost) private readonly posts: Repository<ActivityFeedPost>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
  ) {}

  private assertAdmin(user: User) {
    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!admins.includes((user.email || '').toLowerCase())) {
      throw new ForbiddenException('Acesso administrativo restrito');
    }
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Painel administrativo com indicadores e filas' })
  async dashboard(@CurrentUser() user: User) {
    this.assertAdmin(user);
    const [usersCount, activeUsers, reportsCount, feedbackCount, activitiesCount, postsCount, messagesCount] =
      await Promise.all([
        this.users.count(),
        this.users.count({ where: { isActive: true } }),
        this.reports.count(),
        this.feedback.count(),
        this.activities.count(),
        this.posts.count(),
        this.messages.count(),
      ]);
    const recentReports = await this.reports.find({
      relations: ['reporter', 'reported'],
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const recentFeedback = await this.feedback.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return {
      metrics: { usersCount, activeUsers, reportsCount, feedbackCount, activitiesCount, postsCount, messagesCount },
      recentReports: recentReports.map((r) => ({
        id: r.id,
        reason: r.reason,
        description: r.description,
        createdAt: r.createdAt,
        reporter: r.reporter ? { id: r.reporter.id, name: r.reporter.name } : null,
        reported: r.reported ? { id: r.reported.id, name: r.reported.name, isActive: r.reported.isActive } : null,
      })),
      recentFeedback: recentFeedback.map((f) => ({
        id: f.id,
        type: f.type,
        status: f.status,
        message: f.message,
        createdAt: f.createdAt,
        user: f.user ? { id: f.user.id, name: f.user.name, email: f.user.email } : null,
      })),
    };
  }

  @Get('reports')
  @ApiOperation({ summary: 'Relatórios administrativos de uso, engajamento e segurança' })
  async reportsSummary(@CurrentUser() user: User, @Query('days') days?: string) {
    this.assertAdmin(user);
    const safeDays = Math.max(1, Math.min(Number(days) || 30, 365));
    const since = new Date(Date.now() - safeDays * 86_400_000);
    const [newUsers, completedActivities, feedPosts, chatMessages, securityReports, supportTickets] =
      await Promise.all([
        this.users.createQueryBuilder('u').where('u.createdAt >= :since', { since }).getCount(),
        this.activities.createQueryBuilder('a').where('a.createdAt >= :since', { since }).andWhere('a.isCompleted = :done', { done: true }).getCount(),
        this.posts.createQueryBuilder('p').where('p.createdAt >= :since', { since }).getCount(),
        this.messages.createQueryBuilder('m').where('m.createdAt >= :since', { since }).getCount(),
        this.reports.createQueryBuilder('r').where('r.createdAt >= :since', { since }).getCount(),
        this.feedback.createQueryBuilder('f').where('f.createdAt >= :since', { since }).andWhere('f.type = :type', { type: 'support' }).getCount(),
      ]);
    return {
      periodDays: safeDays,
      usage: { newUsers, completedActivities },
      engagement: { feedPosts, chatMessages },
      safety: { securityReports, supportTickets },
    };
  }
}
