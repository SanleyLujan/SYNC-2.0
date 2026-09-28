import { retainInactiveContent } from '../users/account-retention';
import { BadRequestException, Body, Controller, Get, Header, NotFoundException, Param, Put, UseGuards, ForbiddenException, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ModerationStatus, UserReport } from '../users/entities/user-report.entity';
import { Feedback } from '../feedback/feedback.entity';
import { Activity } from '../activities/entities/activity.entity';
import { ActivityFeedPost } from '../activity-feed/activity-feed.entity';
import { Message } from '../chat/entities/message.entity';
import { PostReport } from '../activity-feed/post-report.entity';
import { VerificationService } from '../verification/verification.service';
import { AuditService } from '../common/security/audit.service';

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
    @InjectRepository(PostReport) private readonly postReports: Repository<PostReport>,
    private readonly verification: VerificationService,
    private readonly audit: AuditService,
  ) {}

  private assertAdmin(user: User) {
    if (!user.isAdmin) {
      throw new ForbiddenException('Acesso administrativo restrito');
    }
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Painel administrativo com indicadores e filas' })
  async dashboard(@CurrentUser() user: User) {
    this.assertAdmin(user);
    const [usersCount, activeUsers, reportsCount, postReportsCount, verificationCount, feedbackCount, activitiesCount, postsCount, messagesCount] =
      await Promise.all([
        this.users.count(),
        this.users.count({ where: { isActive: true } }),
        this.reports.count({ where: { status: ModerationStatus.PENDING } }),
        this.postReports.count({ where: { status: ModerationStatus.PENDING } }),
        this.verification.countPending(),
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
      metrics: { usersCount, activeUsers, reportsCount, postReportsCount, verificationCount, feedbackCount, activitiesCount, postsCount, messagesCount },
      recentReports: recentReports.map((r) => ({
        id: r.id,
        reason: r.reason,
        description: r.description,
        status: r.status,
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

  @Get('moderation')
  @Header('Cache-Control', 'no-store, private')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOperation({ summary: 'Filas de denúncias e verificação pendentes' })
  async moderation(@CurrentUser() user: User) {
    this.assertAdmin(user);
    let verificationError: string | null = null;
    const [userReports, postReports, verifications, verificationStorage] = await Promise.all([
      this.reports.find({
        where: { status: ModerationStatus.PENDING },
        relations: ['reporter', 'reported'],
        order: { createdAt: 'ASC' },
        take: 50,
      }),
      this.postReports.find({
        where: { status: ModerationStatus.PENDING },
        relations: ['reporter', 'post', 'post.user'],
        order: { createdAt: 'ASC' },
        take: 50,
      }),
      this.verification.listPending().catch(() => {
        verificationError = 'Não foi possível carregar os pedidos de verificação. Confira as migrations do backend e tente novamente.';
        return [];
      }),
      this.verification.storageDiagnostics(),
    ]);
    return {
      userReports: userReports.map((r) => ({
        id: r.id, reason: r.reason, description: r.description, createdAt: r.createdAt,
        reporter: { id: r.reporter.id, name: r.reporter.name },
        reported: { id: r.reported.id, name: r.reported.name, avatarUrl: r.reported.avatarUrl, isActive: r.reported.isActive },
      })),
      postReports: postReports.map((r) => ({
        id: r.id, reason: r.reason, description: r.description, createdAt: r.createdAt,
        reporter: { id: r.reporter.id, name: r.reporter.name },
        post: r.post ? {
          id: r.post.id,
          caption: r.post.caption,
          photoUrl: r.post.photoUrl,
          author: r.post.user ? { id: r.post.user.id, name: r.post.user.name } : null,
        } : null,
      })),
      verifications,
      verificationError,
      verificationStorage,
    };
  }

  @Put('user-reports/:id')
  @ApiOperation({ summary: 'Revisar denúncia de conta' })
  async reviewUserReport(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { decision: 'dismiss' | 'deactivate' },
  ) {
    this.assertAdmin(user);
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Denúncia não encontrada');
    if (!['dismiss', 'deactivate'].includes(body?.decision)) throw new BadRequestException('Decisão inválida');
    if (body.decision === 'deactivate') {
      if (report.reported_id === user.id) throw new BadRequestException('Um administrador não pode desativar a própria conta');
      await this.users.manager.transaction(async manager => {
        await manager.getRepository(User).update(report.reported_id, { isActive: false, isProfileVisible: false });
        await retainInactiveContent(manager);
      });
    }
    await this.reports.update(id, {
      status: body.decision === 'dismiss' ? ModerationStatus.DISMISSED : ModerationStatus.ACTIONED,
      reviewed_by: user.id,
      reviewedAt: new Date(),
    });
    await this.audit.log({
      userId: user.id,
      event: 'admin_action',
      detail: `user_report:${id}:${body.decision}:target=${report.reported_id}`,
    });
    return { ok: true };
  }

  @Put('post-reports/:id')
  @ApiOperation({ summary: 'Revisar denúncia de publicação' })
  async reviewPostReport(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { decision: 'dismiss' | 'remove' },
  ) {
    this.assertAdmin(user);
    const report = await this.postReports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Denúncia não encontrada');
    if (!['dismiss', 'remove'].includes(body?.decision)) throw new BadRequestException('Decisão inválida');
    if (body.decision === 'remove') {
      await this.posts.manager.transaction(async manager => {
        await manager.getRepository(ActivityFeedPost).softDelete(report.post_id);
        await retainInactiveContent(manager);
      });
      await this.postReports.update(id, { status: ModerationStatus.ACTIONED, reviewed_by: user.id, reviewedAt: new Date() });
    }
    else await this.postReports.update(id, { status: ModerationStatus.DISMISSED, reviewed_by: user.id, reviewedAt: new Date() });
    await this.audit.log({
      userId: user.id,
      event: 'admin_action',
      detail: `post_report:${id}:${body.decision}:post=${report.post_id}`,
    });
    return { ok: true };
  }

  @Put('verifications/:id')
  @ApiOperation({ summary: 'Aprovar ou recusar verificação de perfil' })
  async reviewVerification(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { decision: 'approve' | 'reject'; reason?: string },
  ) {
    this.assertAdmin(user);
    if (!['approve', 'reject'].includes(body?.decision)) throw new BadRequestException('Decisão inválida');
    const result = await this.verification.review(id, user.id, body.decision, body.reason);
    await this.audit.log({
      userId: user.id,
      event: 'admin_action',
      detail: `verification:${id}:${body.decision}`,
    });
    return result;
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
