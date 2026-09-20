import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { VerificationRequest, VerificationStatus } from './verification-request.entity';
import { PrivateIdentityStorageService } from './private-identity-storage.service';
import { User } from '../users/entities/user.entity';
import { sanitizeText } from '../common/security/sanitize.util';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationRequest) private readonly requests: Repository<VerificationRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: PrivateIdentityStorageService,
  ) {}

  async status(userId: string) {
    const request = await this.requests.findOne({ where: { user_id: userId }, order: { createdAt: 'DESC' } });
    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'isVerified'] });
    return {
      canSubmit: Boolean(user) && !user?.isVerified && request?.status !== VerificationStatus.PENDING && await this.storage.isAvailable(),
      isVerified: Boolean(user?.isVerified),
      status: user?.isVerified ? VerificationStatus.APPROVED : request?.status || 'not_requested',
      rejectionReason: request?.status === VerificationStatus.REJECTED ? request.rejectionReason : null,
      requestedAt: request?.createdAt || null,
    };
  }

  async submit(userId: string, files: { selfie?: Express.Multer.File[]; documentFront?: Express.Multer.File[]; documentBack?: Express.Multer.File[] }) {
    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'isVerified'] });
    if (!user) throw new NotFoundException('Conta não encontrada');
    if (user?.isVerified) throw new BadRequestException('Este perfil já está verificado');
    const pending = await this.requests.findOne({ where: { user_id: userId, status: VerificationStatus.PENDING } });
    if (pending) throw new BadRequestException('Já existe um pedido de verificação em análise');
    const selfie = files.selfie?.[0];
    const front = files.documentFront?.[0];
    const back = files.documentBack?.[0];
    if (!selfie || !front || !back) throw new BadRequestException('Envie selfie e documento frente e verso');
    await this.storage.assertPrivateBucket();
    const [safeSelfie, safeFront, safeBack] = await Promise.all([
      this.storage.sanitizeImage(selfie),
      this.storage.sanitizeImage(front),
      this.storage.sanitizeImage(back),
    ]);
    const requestId = randomUUID();
    const prefix = `kyc/${userId}/${requestId}`;
    const paths = [`${prefix}/selfie.jpg`, `${prefix}/front.jpg`, `${prefix}/back.jpg`];
    const uploaded: string[] = [];
    try {
      for (const [index, contents] of [safeSelfie, safeFront, safeBack].entries()) {
        await this.storage.upload(paths[index], contents);
        uploaded.push(paths[index]);
      }
      await this.requests.save(this.requests.create({
        id: requestId,
        user_id: userId,
        selfieKey: paths[0],
        documentFrontKey: paths[1],
        documentBackKey: paths[2],
        status: VerificationStatus.PENDING,
      }));
      return { ok: true, status: VerificationStatus.PENDING };
    } catch (error) {
      // Best effort apenas neste rollback: ainda não existe registro no banco.
      await this.storage.remove(uploaded).catch(() => undefined);
      throw error;
    }
  }

  async listPending() {
    const rows = await this.requests.createQueryBuilder('request')
      .addSelect(['request.selfieKey', 'request.documentFrontKey', 'request.documentBackKey'])
      .leftJoinAndSelect('request.user', 'user')
      .where('request.status = :status', { status: VerificationStatus.PENDING })
      .orderBy('request.createdAt', 'ASC')
      .take(50)
      .getMany();
    const canRead = rows.length === 0 || await this.storage.isAvailable();
    return Promise.all(rows.map(async (row) => {
      let images: Record<string, string> | null = null;
      let imageError: string | null = null;
      try {
        if (!canRead) throw new Error('private storage unavailable');
        if (!row.selfieKey || !row.documentFrontKey || !row.documentBackKey) throw new Error('missing images');
        const [selfie, documentFront, documentBack] = await Promise.all([
          this.storage.signedUrl(row.selfieKey), this.storage.signedUrl(row.documentFrontKey), this.storage.signedUrl(row.documentBackKey),
        ]);
        images = { selfie, documentFront, documentBack };
      } catch {
        imageError = 'Não foi possível abrir as três imagens. Verifique o armazenamento e atualize os documentos.';
      }
      return {
      id: row.id,
      createdAt: row.createdAt,
      user: { id: row.user_id, name: row.user?.name || 'Conta indisponível', avatarUrl: row.user?.avatarUrl },
      images,
      imageError,
      expiresInSeconds: 300,
      };
    }));
  }

  storageDiagnostics() { return this.storage.diagnostics(); }

  countPending() {
    return this.requests.count({ where: { status: VerificationStatus.PENDING } });
  }

  async removeForUser(userId: string): Promise<void> {
    const rows = await this.requests.createQueryBuilder('request')
      .addSelect(['request.selfieKey', 'request.documentFrontKey', 'request.documentBackKey'])
      .where('request.user_id = :userId', { userId })
      .getMany();
    const paths = rows.flatMap((row) => [row.selfieKey, row.documentFrontKey, row.documentBackKey]).filter(Boolean) as string[];
    if (paths.length) await this.storage.remove(paths);
    await this.requests.delete({ user_id: userId });
  }

  async review(id: string, adminId: string, decision: 'approve' | 'reject', reason?: string) {
    if (!['approve', 'reject'].includes(decision)) throw new BadRequestException('Decisão inválida');
    if (decision === 'reject' && !sanitizeText(reason, 300)) throw new BadRequestException('Informe o motivo da recusa');
    return this.requests.manager.transaction(async (manager) => {
      const query = manager.getRepository(VerificationRequest).createQueryBuilder('request')
        .addSelect(['request.selfieKey', 'request.documentFrontKey', 'request.documentBackKey'])
        .where('request.id = :id', { id });
      if (manager.connection.options.type === 'postgres') query.setLock('pessimistic_write');
      const request = await query.getOne();
      if (!request) throw new NotFoundException('Pedido de verificação não encontrado');
      if (request.status !== VerificationStatus.PENDING) throw new BadRequestException('Pedido já analisado');
      if (request.user_id === adminId) throw new ForbiddenException('Outro administrador precisa analisar seu pedido.');
      const approved = decision === 'approve';
      if (approved) {
        const target = await manager.getRepository(User).findOne({ where: { id: request.user_id }, select: ['id', 'isActive'] });
        if (!target?.isActive) throw new BadRequestException('Não é possível aprovar uma conta excluída ou desativada.');
        if (!request.selfieKey || !request.documentFrontKey || !request.documentBackKey) throw new BadRequestException('Pedido sem as três imagens obrigatórias.');
      }
      // Apaga primeiro. Se o storage falhar, as chaves permanecem no banco para
      // uma nova tentativa e nenhum pedido é marcado como concluído indevidamente.
      await this.storage.remove([request.selfieKey, request.documentFrontKey, request.documentBackKey].filter(Boolean) as string[]);
      await manager.getRepository(User).update(request.user_id, { isVerified: approved });
      await manager.getRepository(VerificationRequest).update(request.id, {
        status: approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED,
        reviewed_by: adminId,
        reviewedAt: new Date(),
        rejectionReason: approved ? null : sanitizeText(reason, 300) || 'Documento não aprovado',
        selfieKey: null,
        documentFrontKey: null,
        documentBackKey: null,
      });
      return { ok: true, status: approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED };
    });
  }
}
