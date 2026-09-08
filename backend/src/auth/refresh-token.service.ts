import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { Request } from 'express';

const REFRESH_DAYS = 7;
const ACCESS_MIN = 15;

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken) private readonly repo: Repository<RefreshToken>,
    private readonly jwt: JwtService,
  ) {}

  /** Cria PAR (access + refresh) em login/register. */
  async issueTokenPair(user: User, req?: Request) {
    const familyId = crypto.randomUUID();
    return this.rotate(user, familyId, req);
  }

  /** Rotaciona refresh: invalida o atual, cria novo na mesma família. */
  private async rotate(user: User, familyId: string, req?: Request, repo = this.repo) {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 3600 * 1000);

    const entity = repo.create({
      userId: user.id,
      familyId,
      tokenHash,
      expiresAt,
      userAgent: req?.headers['user-agent']?.toString().slice(0, 200) || null,
      ipMasked: this.maskIp(req),
    });
    const saved = await repo.save(entity);

    const access = this.jwt.sign(
      { sub: user.id, email: user.email, sid: familyId },
      { expiresIn: `${ACCESS_MIN}m` },
    );

    return {
      accessToken: access,
      refreshToken: rawToken,
      refreshExpiresAt: expiresAt,
      _tokenId: saved.id, // interno (não enviar pro cliente)
    };
  }

  /** Valida refresh; rotaciona; detecta reuse → invalida família. */
  async refresh(rawToken: string, getUser: (id: string) => Promise<User>, req?: Request) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const initial = await this.repo.findOne({ where: { tokenHash } });
    if (!initial) throw new UnauthorizedException('Refresh token inválido');
    const user = await getUser(initial.userId);
    // Mesmo lock usado nas revogações: não pode surgir um descendente válido
    // depois de logout/reuse. Lançar a recusa só após COMMIT da revogação.
    const result = await this.repo.manager.transaction(async manager => {
      const currentUser = await this.lockUser(manager, initial.userId);
      const repo = manager.getRepository(RefreshToken);
      const found = await repo.findOne({ where: { tokenHash } });
      if (!found) throw new UnauthorizedException('Refresh token inválido');
      if (found.revoked) throw new UnauthorizedException('Refresh token revogado');
      if (found.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expirado');

      if (found.used) {
        // REUSE DETECTED — possível roubo. Invalida toda família.
        this.logger.warn('Refresh token reutilizado; família revogada');
        await repo.update({ familyId: found.familyId }, { revoked: true });
        return null;
      }

      if (!user || !currentUser || currentUser.isActive === false || currentUser.emailVerified === false) throw new UnauthorizedException('Usuário indisponível');

      // Consumo atômico: duas requests simultâneas não podem rotacionar o mesmo
      // token e criar dois descendentes válidos na mesma família.
      const consumed = await repo
        .createQueryBuilder()
        .update()
        .set({ used: true })
        .where('id = :id', { id: found.id })
        .andWhere('used = :used', { used: false })
        .andWhere('revoked = :revoked', { revoked: false })
        .andWhere('"expiresAt" > :now', { now: new Date() })
        .execute();
      if (consumed.affected !== 1) {
        await repo.update({ familyId: found.familyId }, { revoked: true });
        return null;
      }

      const pair = await this.rotate(user, found.familyId, req, repo);
      return pair;
    });
    if (!result) throw new UnauthorizedException('Token reutilizado — sessão revogada por segurança');
    return result;
  }

  private async lockUser(manager: EntityManager, userId: string) {
    return manager.getRepository(User).findOne({
      where: { id: userId }, select: ['id', 'isActive', 'emailVerified'],
      ...(manager.connection.options.type === 'postgres' ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
  }

  async assertSessionActive(userId: string, familyId?: string) {
    // Access legados não têm sid: continuam válidos só até sua expiração.
    if (!familyId) return;
    const active = await this.repo.findOne({ where: {
      userId, familyId, used: false, revoked: false, expiresAt: MoreThan(new Date()),
    } });
    if (!active) throw new UnauthorizedException('Sessão revogada');
  }

  /** Logout: revoga toda a família. */
  async revokeFamily(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const found = await this.repo.findOne({ where: { tokenHash } });
    if (!found) return;
    await this.revokeSession(found.userId, found.familyId);
  }

  /** Lista sessões ativas do usuário. */
  async listSessions(userId: string) {
    const rows = await this.repo.find({
      where: { userId, used: false, revoked: false, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    // Agrupa por família (1 família = 1 sessão)
    const byFamily = new Map<string, any>();
    for (const r of rows) {
      const existing = byFamily.get(r.familyId);
      if (!existing || new Date(r.createdAt) > new Date(existing.lastActive)) {
        byFamily.set(r.familyId, {
          familyId: r.familyId,
          userAgent: r.userAgent,
          ipMasked: r.ipMasked,
          createdAt: r.createdAt,
          lastActive: r.createdAt,
          expiresAt: r.expiresAt,
        });
      }
    }
    return [...byFamily.values()];
  }

  /** Revoga uma sessão específica (por familyId). */
  async revokeSession(userId: string, familyId: string) {
    await this.repo.manager.transaction(async manager => {
      await this.lockUser(manager, userId);
      await manager.getRepository(RefreshToken).update({ userId, familyId }, { revoked: true });
    });
    return { ok: true };
  }

  /** Revoga todas as sessões exceto a atual. */
  async revokeAllExcept(userId: string, keepFamilyId: string) {
    await this.repo.manager.transaction(async manager => {
      await this.lockUser(manager, userId);
      await manager.getRepository(RefreshToken)
        .createQueryBuilder()
        .update()
        .set({ revoked: true })
        .where('user_id = :userId AND "familyId" != :fam', { userId, fam: keepFamilyId })
        .execute();
    });
    return { ok: true };
  }

  async revokeAllForUser(userId: string) {
    await this.repo.manager.transaction(async manager => {
      await this.lockUser(manager, userId);
      await manager.getRepository(RefreshToken).update({ userId }, { revoked: true });
    });
  }

  private maskIp(req?: Request): string | null {
    if (!req) return null;
    const fwd = req.headers['x-forwarded-for'];
    const ip = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket?.remoteAddress) || '';
    if (!ip) return null;
    if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + ':0:0:0:0';
    const parts = ip.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : ip;
  }
}
