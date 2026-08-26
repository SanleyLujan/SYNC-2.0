import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { ActivityFeedPost } from './activity-feed.entity';
import { UserBlock } from '../users/entities/user-block.entity';
import { Match } from '../matching/entities/match.entity';
import { FeedComment } from './feed-comment.entity';
import { FeedLike } from './feed-like.entity';
import { sanitizeText, sanitizeUrl } from '../common/security/sanitize.util';

// Projeta apenas campos públicos do usuário (sem email, lat, long)
function safeFeedUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    city: user.city,
    sports: user.sports,
    level: user.level,
  };
}

@Injectable()
export class ActivityFeedService {
  constructor(
    @InjectRepository(ActivityFeedPost)
    private readonly repo: Repository<ActivityFeedPost>,
    @InjectRepository(FeedComment)
    private readonly commentRepo: Repository<FeedComment>,
    @InjectRepository(FeedLike)
    private readonly likeRepo: Repository<FeedLike>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
  ) {}

  async create(
    userId: string,
    dto: {
      activityId?: string;
      caption?: string;
      photoUrl?: string;
      distanceKm?: number;
      durationSeconds?: number;
      avgPace?: number;
      calories?: number;
      sport?: string;
    },
  ) {
    if ((!dto.caption || dto.caption.trim().length === 0) && !dto.activityId && !dto.photoUrl) {
      throw new BadRequestException('Post precisa ter caption, atividade ou foto');
    }
    const post = this.repo.create({
      user_id: userId,
      activity_id: dto.activityId || null,
      caption: sanitizeText(dto.caption, 500) || null,
      photoUrl: sanitizeUrl(dto.photoUrl),
      distanceKm: Math.max(0, Math.min(10000, dto.distanceKm || 0)),
      durationSeconds: Math.max(0, Math.min(86400 * 7, dto.durationSeconds || 0)),
      avgPace: Math.max(0, Math.min(60, dto.avgPace || 0)),
      calories: Math.max(0, Math.min(100000, dto.calories || 0)),
      sport: sanitizeText(dto.sport, 40) || null,
    });
    return this.repo.save(post);
  }

  async feed(viewerId: string, page = 1, limit = 20) {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const safePage = Math.max(1, Math.min(page, 1000));

    // SEGURANÇA: não mostra posts de quem você bloqueou nem de quem te bloqueou.
    // O Feed também só inclui o próprio usuário e matches mútuos.
    const allowedUserIds = await this.getAllowedFeedUserIds(viewerId);

    const posts = await this.repo.find({
      relations: ['user'],
      where: { user_id: In(Array.from(allowedUserIds)) },
      order: { createdAt: 'DESC' },
      take: safeLimit,
      skip: (safePage - 1) * safeLimit,
    });
    return posts.map((p) => ({ ...p, user: safeFeedUser(p.user) }));
  }

  // IDs de usuários bloqueados nos dois sentidos (você bloqueou OU te bloqueou).
  private async getBlockedUserIds(viewerId: string): Promise<string[]> {
    const blocks = await this.repo.manager.find(UserBlock, {
      where: [{ blocker_id: viewerId }, { blocked_id: viewerId }],
      select: ['blocker_id', 'blocked_id'],
    });
    return blocks.map((b) => (b.blocker_id === viewerId ? b.blocked_id : b.blocker_id));
  }

  async byUser(viewerId: string, userId: string, page = 1, limit = 20) {
    const allowedUserIds = await this.getAllowedFeedUserIds(viewerId);
    if (!allowedUserIds.has(userId)) {
      throw new ForbiddenException('O feed deste usuário só está disponível após um match.');
    }
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const safePage = Math.max(1, Math.min(page, 1000));
    const posts = await this.repo.find({
      where: { user_id: userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: safeLimit,
      skip: (safePage - 1) * safeLimit,
    });
    return posts.map((p) => ({ ...p, user: safeFeedUser(p.user) }));
  }

  async like(postId: string, userId: string) {
    const post = await this.assertPostVisible(postId, userId);

    // Idempotente: insere somente se o usuário ainda não curtiu
    const existing = await this.likeRepo.findOne({ where: { post_id: postId, user_id: userId } });
    if (existing) {
      return { likesCount: post.likesCount, alreadyLiked: true };
    }

    await this.likeRepo.save({ post_id: postId, user_id: userId });
    await this.repo.increment({ id: postId }, 'likesCount', 1);
    return { likesCount: post.likesCount + 1, alreadyLiked: false };
  }

  async unlike(postId: string, userId: string) {
    const post = await this.assertPostVisible(postId, userId);

    const existing = await this.likeRepo.findOne({ where: { post_id: postId, user_id: userId } });
    if (!existing) {
      return { likesCount: post.likesCount, alreadyUnliked: true };
    }

    await this.likeRepo.delete({ post_id: postId, user_id: userId });
    if (post.likesCount > 0) {
      await this.repo.decrement({ id: postId }, 'likesCount', 1);
    }
    return { likesCount: Math.max(0, post.likesCount - 1), alreadyUnliked: false };
  }

  /** Retorna os IDs dos posts curtidos pelo usuário (para estado inicial do feed) */
  async getLikedPostIds(userId: string, postIds: string[]): Promise<string[]> {
    if (postIds.length === 0) return [];
    // Cap a 100 IDs por chamada para evitar IN query gigante
    const safeIds = postIds.slice(0, 100);
    const likes = await this.likeRepo
      .createQueryBuilder('fl')
      .select('fl.post_id')
      .where('fl.user_id = :userId', { userId })
      .andWhere('fl.post_id IN (:...postIds)', { postIds: safeIds })
      .getRawMany();
    return likes.map((l) => l.fl_post_id);
  }

  async getComments(postId: string, viewerId: string, page = 1, limit = 20) {
    await this.assertPostVisible(postId, viewerId);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const safePage = Math.max(1, Math.min(page, 1000));
    const comments = await this.commentRepo.find({
      where: { post_id: postId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: safeLimit,
      skip: (safePage - 1) * safeLimit,
    });
    return comments.map((c) => ({ ...c, user: safeFeedUser(c.user) }));
  }

  async addComment(postId: string, userId: string, text: string) {
    if (!text || text.trim().length === 0) throw new BadRequestException('Comentário não pode ser vazio');
    if (text.length > 500) throw new BadRequestException('Comentário muito longo (máx 500 chars)');
    const post = await this.assertPostVisible(postId, userId);
    const comment = this.commentRepo.create({
      post_id: postId,
      user_id: userId,
      text: sanitizeText(text, 500),
    });
    const saved = await this.commentRepo.save(comment);
    await this.repo.increment({ id: postId }, 'commentsCount', 1);
    const full = await this.commentRepo.findOne({ where: { id: saved.id }, relations: ['user'] });
    return full ? { ...full, user: safeFeedUser(full.user) } : saved;
  }

  async deleteComment(postId: string, commentId: string, userId: string) {
    await this.assertPostVisible(postId, userId);
    const comment = await this.commentRepo.findOne({ where: { id: commentId, post_id: postId } });
    if (!comment) throw new NotFoundException('Comentário não encontrado');
    if (comment.user_id !== userId) throw new BadRequestException('Você não é dono deste comentário');
    await this.commentRepo.remove(comment);
    await this.repo.decrement({ id: postId }, 'commentsCount', 1);
    return { ok: true };
  }

  async delete(userId: string, postId: string) {
    const post = await this.repo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');
    if (post.user_id !== userId) throw new BadRequestException('Você não é dono deste post');
    await this.repo.remove(post);
    return { ok: true };
  }

  private async getAllowedFeedUserIds(viewerId: string): Promise<Set<string>> {
    const [blockedIds, matches] = await Promise.all([
      this.getBlockedUserIds(viewerId),
      this.matchRepo.find({
        where: [{ user1_id: viewerId }, { user2_id: viewerId }],
        select: ['user1_id', 'user2_id'],
      }),
    ]);
    const allowed = new Set<string>([viewerId]);
    for (const match of matches) {
      allowed.add(match.user1_id === viewerId ? match.user2_id : match.user1_id);
    }
    for (const blockedId of blockedIds) allowed.delete(blockedId);
    return allowed;
  }

  private async assertPostVisible(postId: string, viewerId: string): Promise<ActivityFeedPost> {
    const post = await this.repo.findOne({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post não encontrado');
    const allowedUserIds = await this.getAllowedFeedUserIds(viewerId);
    if (!allowedUserIds.has(post.user_id)) {
      throw new ForbiddenException('Você precisa ter match para interagir com este post.');
    }
    return post;
  }
}
