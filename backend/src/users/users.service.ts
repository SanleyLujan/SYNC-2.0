import { retainInactiveContent } from './account-retention';
import { Like as ProfileLike } from '../matching/entities/like.entity';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like as ILike } from 'typeorm';
import { User } from './entities/user.entity';
import { UserBlock } from './entities/user-block.entity';
import { BannedCpf } from './entities/banned-cpf.entity';
import { UserReport } from './entities/user-report.entity';
import { Match } from '../matching/entities/match.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ModerationStatus, ReportReason } from './entities/user-report.entity';
import { sanitizeText } from '../common/security/sanitize.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserBlock)
    private readonly userBlockRepository: Repository<UserBlock>,
    @InjectRepository(UserReport)
    private readonly userReportRepository: Repository<UserReport>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  /**
   * Perfil público seguro: remove email, lat/long precisos e outros dados sensíveis.
   * Usar para GET /users/:id (perfil de outro usuário).
   */
  async publicProfile(id: string) {
    const user = await this.findById(id);
    if (!user.isActive || !user.isProfileVisible) {
      throw new ForbiddenException('Perfil não está visível no momento');
    }
    return {
      id: user.id,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      profilePhotos: user.profilePhotos,
      prompts: user.prompts,
      sports: user.sports,
      level: user.level,
      objectives: user.objectives,
      hobbies: user.hobbies,
      availability: user.availability,
      city: user.showLocation ? user.city : null,
      showLocation: user.showLocation,
      isActive: user.isActive,
      totalXP: user.totalXP,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
    };
  }

  /** Deactivate atomically, retaining account and related evidence in the database. */
  async deactivateAccount(userId: string): Promise<{ ok: true; message: string }> {
    await this.userRepository.manager.transaction(async manager => {
      await manager.getRepository(User).update(userId, {
        isActive: false, isProfileVisible: false, deletedAt: new Date(),
        pushNotificationsEnabled: false, emailNotificationsEnabled: false,
        inAppNotificationsEnabled: false,
        resetPasswordToken: null, resetPasswordExpires: null,
        emailVerificationToken: null, emailVerificationExpires: null,
      });
      await retainInactiveContent(manager);
    });
    return { ok: true, message: 'Conta desativada. Seu perfil e conteúdo não aparecem mais no app. Os registros permanecem inativos na base por segurança.' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    const sanitized: any = {
      ...dto,
      ...(dto.name !== undefined && { name: sanitizeText(dto.name, 100) }),
      ...(dto.bio !== undefined && { bio: sanitizeText(dto.bio, 500) || undefined }),
      ...(dto.city !== undefined && { city: sanitizeText(dto.city, 100) || undefined }),
    };
    if (dto.hobbies !== undefined) {
      sanitized.hobbies = Array.isArray(dto.hobbies)
        ? dto.hobbies.map((h) => sanitizeText(h, 40)).filter(Boolean).slice(0, 12)
        : null;
    }
    // Frases estilo Tinder: máx 5, pergunta ≤ 60, resposta ≤ 150, sanitizadas.
    if (dto.prompts !== undefined) {
      sanitized.prompts = Array.isArray(dto.prompts)
        ? dto.prompts
            .filter((p) => p && typeof p.q === 'string' && typeof p.a === 'string' && p.a.trim().length > 0)
            .slice(0, 5)
            .map((p) => ({ q: sanitizeText(p.q, 60), a: sanitizeText(p.a, 150) }))
        : null;
    }
    await this.userRepository.update(userId, sanitized);
    return this.findById(userId);
  }

  // Completar onboarding - marca que o usuário finalizou o fluxo inicial
  async completeOnboarding(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<User> {
    const sanitized: UpdateProfileDto = {
      ...data,
      ...(data.name !== undefined && { name: sanitizeText(data.name, 100) }),
      ...(data.bio !== undefined && { bio: sanitizeText(data.bio, 500) || undefined }),
      ...(data.city !== undefined && { city: sanitizeText(data.city, 100) || undefined }),
    };
    if (data.hobbies !== undefined) {
      sanitized.hobbies = Array.isArray(data.hobbies)
        ? data.hobbies.map((h) => sanitizeText(h, 40)).filter(Boolean).slice(0, 12)
        : undefined;
    }
    await this.userRepository.update(userId, {
      ...sanitized,
      onboardingCompleted: true,
    });
    return this.findById(userId);
  }

  // Atualizar localização do usuário
  async updateLocation(
    userId: string,
    latitude: number,
    longitude: number,
    city?: string,
  ): Promise<void> {
    await this.userRepository.update(userId, { latitude, longitude, city });
  }

  async nearbyVisibleUsers(userId: string, latitude: number, longitude: number, radiusKm = 10) {
    const safeRadius = Math.max(1, Math.min(radiusKm, 50));
    const blocks = await this.userBlockRepository.find({
      where: [{ blocker_id: userId }, { blocked_id: userId }],
      select: ['blocker_id', 'blocked_id'],
    });
    const blockedIds = new Set(
      blocks.map((block) => (block.blocker_id === userId ? block.blocked_id : block.blocker_id)),
    );
    const matches = await this.matchRepository.find({
      where: [{ user1_id: userId }, { user2_id: userId }],
      select: ['user1_id', 'user2_id'],
    });
    const matchedIds = matches.map((match) => (
      match.user1_id === userId ? match.user2_id : match.user1_id
    ));
    if (matchedIds.length === 0) return [];
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id != :userId', { userId })
      .andWhere('user.isActive = :active', { active: true })
      .andWhere('user.onboardingCompleted = :completed', { completed: true })
      .andWhere('user.isProfileVisible = :visible', { visible: true })
      .andWhere('user.showLocation = :showLocation', { showLocation: true })
      .andWhere('user.id IN (:...matchedIds)', { matchedIds })
      .andWhere('user.latitude IS NOT NULL')
      .andWhere('user.longitude IS NOT NULL')
      .take(200)
      .getMany();

    // O mapa nunca recebe a coordenada real de outra pessoa. A posição é
    // arredondada para uma área de aproximadamente 1 km antes de sair da API.
    const approximateCoordinate = (value: number) => Math.round(value * 100) / 100;

    return users
      .filter((u) => !blockedIds.has(u.id))
      .map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        city: u.city,
        sports: u.sports,
        level: u.level,
        distance: Math.round(this.distanceKm(latitude, longitude, u.latitude || 0, u.longitude || 0) * 10) / 10,
        latitude: approximateCoordinate(u.latitude as number),
        longitude: approximateCoordinate(u.longitude as number),
      }))
      .filter((u) => u.distance <= safeRadius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 50);
  }

  private distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const r = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Salvar URL do avatar — chamado após upload
  async updateAvatar(userId: string, avatarUrl: string): Promise<User> {
    await this.userRepository.update(userId, { avatarUrl });
    return this.findById(userId);
  }

  async updateBanner(userId: string, bannerUrl: string): Promise<User> {
    await this.userRepository.update(userId, { bannerUrl });
    return this.findById(userId);
  }

  // Salvar fotos do perfil (array de data URLs base64 ou URLs, máx 5)
  async updateProfilePhotos(userId: string, photos: string[]): Promise<User> {
    if (!Array.isArray(photos) || photos.length < 1) {
      throw new Error('Envie pelo menos 1 foto.');
    }
    const limited = photos.slice(0, 5);
    // Se o usuário ainda não tem avatar, usa a 1ª foto como avatar — assim a
    // foto do onboarding aparece no perfil, no discovery e no chat.
    const current = await this.userRepository.findOne({ where: { id: userId }, select: ['id', 'avatarUrl'] });
    const patch: Partial<User> = { profilePhotos: limited };
    if (!current?.avatarUrl) {
      patch.avatarUrl = limited[0];
    }
    await this.userRepository.update(userId, patch);
    return this.findById(userId);
  }

  // Buscar usuários por nome
  async searchUsers(
    query: string,
    currentUserId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    // Cap para prevenir varredura de banco via parâmetros manipulados
    const safePage = Math.max(1, Math.min(page, 100));
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const skip = (safePage - 1) * safeLimit;
    // Sanitiza o termo de busca antes de usar em LIKE
    const safeQuery = sanitizeText(query, 100).replace(/[%_\\]/g, '\\$&');
    if (!safeQuery) return { users: [], total: 0, page: safePage, limit: safeLimit, totalPages: 0 };

    const [users, total] = await this.userRepository
      .createQueryBuilder('user')
      .where('(LOWER(user.name) LIKE LOWER(:query) OR CAST(user.id AS text) = :exactId)', {
        query: `%${safeQuery}%`,
        exactId: safeQuery,
      })
      .andWhere('user.id != :currentUserId', { currentUserId })
      .andWhere('NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = :currentUserId AND b.blocked_id = user.id) OR (b.blocked_id = :currentUserId AND b.blocker_id = user.id))')
      .andWhere('user.isActive = :isActive', { isActive: true })
      .andWhere('user.isProfileVisible = :isProfileVisible', { isProfileVisible: true })
      .select([
        'user.id',
        'user.name',
        'user.avatarUrl',
        'user.sports',
        'user.level',
        'user.city',
        'user.showLocation',
      ])
      .skip(skip)
      .take(safeLimit)
      .getManyAndCount();

    const matches = await this.matchRepository.find({
      where: [{ user1_id: currentUserId }, { user2_id: currentUserId }],
      select: ['user1_id', 'user2_id'],
    });
    const matchedIds = new Set(matches.map((match) => (
      match.user1_id === currentUserId ? match.user2_id : match.user1_id
    )));

    const pending = await this.userRepository.manager.getRepository(ProfileLike).find({
      where: { from_user_id: currentUserId, isLike: true }, select: ['to_user_id'],
    });
    const pendingIds = new Set(pending.map(l => l.to_user_id));
    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        sports: u.sports,
        level: u.level,
        city: u.showLocation ? u.city : null,
        matchStatus: matchedIds.has(u.id) ? 'matched' : pendingIds.has(u.id) ? 'pending' : 'available',
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  // Bloquear usuário
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Você não pode bloquear a si mesmo');
    }

    await this.findById(blockedId);

    const existing = await this.userBlockRepository.findOne({
      where: { blocker_id: blockerId, blocked_id: blockedId },
    });
    if (existing) {
      throw new BadRequestException('Usuário já está bloqueado');
    }

    await this.userBlockRepository.save({
      blocker_id: blockerId,
      blocked_id: blockedId,
    });
  }

  // Desbloquear usuário
  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const result = await this.userBlockRepository.delete({
      blocker_id: blockerId,
      blocked_id: blockedId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Bloqueio não encontrado');
    }
  }

  // Listar usuários bloqueados
  async getBlockedUsers(userId: string) {
    const blocks = await this.userBlockRepository.find({
      where: { blocker_id: userId },
      relations: ['blocked'],
      order: { createdAt: 'DESC' },
    });

    return blocks.filter(block => block.blocked?.isActive).map((block) => ({
      id: block.blocked.id,
      name: block.blocked.name,
      avatarUrl: block.blocked.avatarUrl,
      blockedAt: block.createdAt,
    }));
  }

  // Verificar se algum dos usuários bloqueou o outro
  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const block = await this.userBlockRepository.findOne({
      where: [
        { blocker_id: userId1, blocked_id: userId2 },
        { blocker_id: userId2, blocked_id: userId1 },
      ],
    });
    return !!block;
  }

  // Reportar usuário
  async reportUser(
    reporterId: string,
    reportedId: string,
    reason: ReportReason,
    description?: string,
  ): Promise<void> {
    if (reporterId === reportedId) {
      throw new BadRequestException('Você não pode reportar a si mesmo');
    }

    await this.findById(reportedId);

    // Sanitiza descrição antes de persistir (evita XSS no painel admin)
    const safeDescription = description ? sanitizeText(description, 500) : undefined;

    const existing = await this.userReportRepository.findOne({
      where: { reporter_id: reporterId, reported_id: reportedId, status: ModerationStatus.PENDING },
    });
    if (existing) return;

    await this.userReportRepository.save({
      reporter_id: reporterId,
      reported_id: reportedId,
      reason,
      description: safeDescription,
      status: ModerationStatus.PENDING,
    });
  }

  // Adiciona o hash do CPF do usuário (se houver) à lista de banidos, pra
  // impedir que a pessoa crie outra conta com o mesmo CPF.
  private async addCpfToBanList(userId: string, reason: string): Promise<void> {
    const u = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'cpfHash'],
    });
    if (!u?.cpfHash) return;
    await this.userRepository.manager
      .createQueryBuilder()
      .insert()
      .into(BannedCpf)
      .values({ cpfHash: u.cpfHash, reason })
      .orIgnore() // não falha se já estiver na lista
      .execute();
  }
}
