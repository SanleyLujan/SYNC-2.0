import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      isVerified: Boolean(user?.isVerified),
      status: user?.isVerified ? VerificationStatus.APPROVED : request?.status || 'not_requested',
      rejectionReason: request?.status === VerificationStatus.REJECTED ? request.rejectionReason : null,
      requestedAt: request?.createdAt || null,
    };
  }

  async submit(userId: string, files: { selfie?: Express.Multer.File[]; documentFront?: Express.Multer.File[]; documentBack?: Express.Multer.File[] }) {
    const user = await this.users.findOne({ where: { id: userId }, select: ['id', 'isVerified'] });
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
    return Promise.all(rows.map(async (row) => ({
      id: row.id,
      createdAt: row.createdAt,
      user: { id: row.user.id, name: row.user.name, avatarUrl: row.user.avatarUrl },
      images: {
        selfie: await this.storage.signedUrl(row.selfieKey!),
        documentFront: await this.storage.signedUrl(row.documentFrontKey!),
        documentBack: await this.storage.signedUrl(row.documentBackKey!),
      },
      expiresInSeconds: 300,
    })));
  }

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
    const request = await this.requests.createQueryBuilder('request')
      .addSelect(['request.selfieKey', 'request.documentFrontKey', 'request.documentBackKey'])
      .where('request.id = :id', { id })
      .getOne();
    if (!request) throw new NotFoundException('Pedido de verificação não encontrado');
    if (request.status !== VerificationStatus.PENDING) throw new BadRequestException('Pedido já analisado');
    if (decision === 'reject' && !sanitizeText(reason, 300)) throw new BadRequestException('Informe o motivo da recusa');
    const approved = decision === 'approve';
    // Apaga primeiro. Se o storage falhar, as chaves permanecem no banco para
    // uma nova tentativa e nenhum pedido é marcado como concluído indevidamente.
    await this.storage.remove([request.selfieKey, request.documentFrontKey, request.documentBackKey].filter(Boolean) as string[]);
    await this.requests.manager.transaction(async (manager) => {
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
    });
    return { ok: true, status: approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED };
  }
}
