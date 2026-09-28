import { retainContentRemoval } from '../users/account-retention';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './entities/group.entity';
import { GroupMember } from './entities/group-member.entity';
import { GroupJoinRequest } from './entities/group-join-request.entity';
import { randomBytes } from 'crypto';
import { sanitizeText } from '../common/security/sanitize.util';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group) private readonly groupRepo: Repository<Group>,
    @InjectRepository(GroupMember) private readonly memberRepo: Repository<GroupMember>,
    @InjectRepository(GroupJoinRequest) private readonly requestRepo: Repository<GroupJoinRequest>,
  ) {}

  async create(adminId: string, dto: { name: string; description?: string; sport?: string; city?: string; isPrivate?: boolean }) {
    if (!dto.name || dto.name.trim().length < 3) {
      throw new BadRequestException('Nome do grupo precisa ter pelo menos 3 caracteres');
    }
    const group = this.groupRepo.create({
      name: sanitizeText(dto.name, 80),
      description: sanitizeText(dto.description, 500) || null,
      sport: sanitizeText(dto.sport, 40) || null,
      city: sanitizeText(dto.city, 80) || null,
      isPrivate: !!dto.isPrivate,
      admin_id: adminId,
      inviteCode: dto.isPrivate ? randomBytes(6).toString('hex') : null,
      memberCount: 1,
    });
    const saved = await this.groupRepo.save(group);
    await this.memberRepo.save(
      this.memberRepo.create({ group_id: saved.id, user_id: adminId, role: 'admin' }),
    );
    return saved;
  }

  async listPublic(opts: { city?: string; sport?: string; page?: number }) {
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .where('g.isPrivate = :pub', { pub: false })
      .orderBy('g.totalDistanceKm', 'DESC')
      .take(20)
      .skip(((opts.page || 1) - 1) * 20);
    if (opts.city) qb.andWhere('g.city = :city', { city: opts.city });
    if (opts.sport) qb.andWhere('g.sport = :sport', { sport: opts.sport });
    return qb.getMany();
  }

  async getById(groupId: string, requesterId?: string) {
    const group = await this.groupRepo.findOne({
      where: { id: groupId },
      relations: ['admin'],
    });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    const membership = requesterId
      ? await this.memberRepo.findOne({ where: { group_id: groupId, user_id: requesterId } })
      : null;
    const isMember = !!membership;
    const joinRequest = requesterId && group.isPrivate && !isMember
      ? await this.requestRepo.findOne({ where: { group_id: groupId, user_id: requesterId } })
      : null;
    // Projeta apenas campos públicos do admin (sem email, lat, long)
    const safeAdmin = group.admin
      ? {
          id: (group.admin as any).id,
          name: (group.admin as any).name,
          avatarUrl: (group.admin as any).avatarUrl,
          city: (group.admin as any).city,
          level: (group.admin as any).level,
        }
      : null;
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      sport: group.sport,
      city: group.city,
      isPrivate: group.isPrivate,
      inviteCode: requesterId === group.admin_id ? group.inviteCode : null,
      avatarUrl: group.avatarUrl,
      coverUrl: group.coverUrl,
      admin_id: group.admin_id,
      memberCount: group.memberCount,
      totalDistanceKm: group.totalDistanceKm,
      totalActivities: group.totalActivities,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      admin: safeAdmin,
      isMember,
      joinRequestStatus: joinRequest?.status || null,
    };
  }

  async myGroups(userId: string) {
    const members = await this.memberRepo.find({
      where: { user_id: userId },
      relations: ['group'],
    });
    return members.map((m) => ({ ...m.group, role: m.role, contributedKm: m.contributedKm }));
  }

  async join(userId: string, groupId: string, inviteCode?: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    if (group.isPrivate && group.inviteCode !== inviteCode) {
      return this.requestJoin(userId, groupId);
    }
    const existing = await this.memberRepo.findOne({ where: { group_id: groupId, user_id: userId } });
    if (existing) return existing;
    const member = await this.memberRepo.save(
      this.memberRepo.create({ group_id: groupId, user_id: userId, role: 'member' }),
    );
    await this.groupRepo.increment({ id: groupId }, 'memberCount', 1);
    return member;
  }

  async requestJoin(userId: string, groupId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    if (!group.isPrivate) throw new BadRequestException('Solicitações só existem para grupos privados');
    const existingMember = await this.memberRepo.findOne({ where: { group_id: groupId, user_id: userId } });
    if (existingMember) return { ok: true, status: 'already_member' };
    const existing = await this.requestRepo.findOne({ where: { group_id: groupId, user_id: userId } });
    if (existing) {
      if (existing.status !== 'pending') {
        existing.status = 'pending';
        await this.requestRepo.save(existing);
      }
      return { ok: true, status: 'pending', requestId: existing.id };
    }
    const req = await this.requestRepo.save(this.requestRepo.create({ group_id: groupId, user_id: userId }));
    return { ok: true, status: 'pending', requestId: req.id };
  }

  async listJoinRequests(adminId: string, groupId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    if (group.admin_id !== adminId) throw new ForbiddenException('Só o admin pode ver solicitações');
    const requests = await this.requestRepo.find({
      where: { group_id: groupId, status: 'pending' },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return requests.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      user: r.user ? {
        id: r.user.id,
        name: r.user.name,
        avatarUrl: r.user.avatarUrl,
        city: r.user.city,
        sports: r.user.sports,
        level: r.user.level,
      } : null,
    }));
  }

  async decideJoinRequest(adminId: string, groupId: string, requestId: string, approve: boolean) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    if (group.admin_id !== adminId) throw new ForbiddenException('Só o admin pode aprovar solicitações');
    const req = await this.requestRepo.findOne({ where: { id: requestId, group_id: groupId } });
    if (!req) throw new NotFoundException('Solicitação não encontrada');
    if (req.status !== 'pending') throw new BadRequestException('Solicitação já foi analisada');
    req.status = approve ? 'approved' : 'rejected';
    await this.requestRepo.save(req);
    if (!approve) return { ok: true, status: 'rejected' };
    const existing = await this.memberRepo.findOne({ where: { group_id: groupId, user_id: req.user_id } });
    if (!existing) {
      await this.memberRepo.save(this.memberRepo.create({ group_id: groupId, user_id: req.user_id, role: 'member' }));
      await this.groupRepo.increment({ id: groupId }, 'memberCount', 1);
    }
    return { ok: true, status: 'approved' };
  }

  async removeMember(adminId: string, groupId: string, memberId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    if (group.admin_id !== adminId) throw new ForbiddenException('Só o admin pode remover membros');
    const member = await this.memberRepo.findOne({ where: { id: memberId, group_id: groupId } });
    if (!member) throw new NotFoundException('Membro não encontrado');
    if (member.role === 'admin') throw new BadRequestException('Admin não pode ser removido');
    await this.memberRepo.remove(member);
    await this.groupRepo.decrement({ id: groupId }, 'memberCount', 1);
    return { ok: true };
  }

  async leave(userId: string, groupId: string) {
    const member = await this.memberRepo.findOne({ where: { group_id: groupId, user_id: userId } });
    if (!member) throw new NotFoundException('Você não é membro deste grupo');
    if (member.role === 'admin') {
      throw new BadRequestException('Admin não pode sair. Transfira a admin ou delete o grupo.');
    }
    await this.memberRepo.remove(member);
    await this.groupRepo.decrement({ id: groupId }, 'memberCount', 1);
    return { ok: true };
  }

  async listMembers(groupId: string) {
    const members = await this.memberRepo.find({
      where: { group_id: groupId },
      relations: ['user'],
      order: { contributedKm: 'DESC' },
      take: 100,
    });
    // Projeta apenas campos públicos dos membros (sem email, lat, long)
    return members.map((m) => ({
      id: m.id,
      role: m.role,
      contributedKm: m.contributedKm,
      contributedActivities: (m as any).contributedActivities,
      joinedAt: m.joinedAt,
      user: m.user
        ? {
            id: (m.user as any).id,
            name: (m.user as any).name,
            avatarUrl: (m.user as any).avatarUrl,
            city: (m.user as any).city,
            level: (m.user as any).level,
            sports: (m.user as any).sports,
          }
        : null,
    }));
  }

  async groupRanking(opts: { sport?: string; city?: string }) {
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .orderBy('g.totalDistanceKm', 'DESC')
      .take(50);
    if (opts.sport) qb.andWhere('g.sport = :s', { s: opts.sport });
    if (opts.city) qb.andWhere('g.city = :c', { c: opts.city });
    const list = await qb.getMany();
    return list.map((g, i) => ({ position: i + 1, ...g }));
  }

  /** Contabiliza nova atividade — chamado pelo ActivitiesService quando finalizar */
  async creditActivity(userId: string, distanceKm: number) {
    const memberships = await this.memberRepo.find({ where: { user_id: userId } });
    for (const m of memberships) {
      await this.memberRepo.increment({ id: m.id }, 'contributedKm', distanceKm);
      await this.memberRepo.increment({ id: m.id }, 'contributedActivities', 1);
      await this.groupRepo.increment({ id: m.group_id }, 'totalDistanceKm', distanceKm);
      await this.groupRepo.increment({ id: m.group_id }, 'totalActivities', 1);
    }
  }

  async delete(userId: string, groupId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Grupo não encontrado');
    if (group.admin_id !== userId) throw new ForbiddenException('Só o admin pode deletar');
    await retainContentRemoval(this.groupRepo, group.id);
    return { ok: true };
  }
}
