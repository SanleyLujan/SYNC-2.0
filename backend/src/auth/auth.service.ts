import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { BannedCpf } from '../users/entities/banned-cpf.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { EmailService } from './email.service';
import { AuditService } from '../common/security/audit.service';
import { Request } from 'express';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

// Valida CPF pelos dígitos verificadores (rejeita inventado/repetido).
function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais (000..., 111...)
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

// Token de sucesso/falha de login retorna a MESMA mensagem (anti-enumeração)
const GENERIC_INVALID = 'Credenciais inválidas';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, req?: Request) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('As senhas não conferem');
    }

    // Validação de senha forte
    this.assertStrongPassword(dto.password);

    const email = dto.email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({ where: { email } });

    // ANTI-ENUMERAÇÃO: se já existe, ainda retornamos sucesso aparente porém
    // sem criar conta. Para o atacante, o tempo de resposta é equivalente.
    // (O usuário legítimo já saberá que tem conta no fluxo de login.)
    if (existing) {
      await this.audit.log({ event: 'register_failure', req, detail: 'duplicate_email' });
      // Espera ~bcrypt time pra não vazar timing
      await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      throw new ConflictException('Não foi possível criar conta com esses dados');
    }

    // CPF obrigatório: valida dígito verificador, gera hash, barra reincidência.
    const digits = (dto.cpf || '').replace(/\D/g, '');
    if (!isValidCpf(digits)) {
      throw new BadRequestException('CPF inválido. Confira os 11 dígitos.');
    }
    const cpfHash = crypto
      .createHash('sha256')
      .update(digits + (process.env.CPF_HASH_SALT || 'sync-cpf-salt'))
      .digest('hex');
    const banned = await this.userRepository.manager.findOne(BannedCpf, {
      where: { cpfHash },
    });
    if (banned) {
      await this.audit.log({ event: 'register_failure', req, detail: 'banned_cpf' });
      throw new ConflictException(
        'Não foi possível criar a conta. Este CPF está impedido de usar o app.',
      );
    }
    // Um CPF = uma conta: bloqueia se já existe usuário ativo com esse hash.
    const cpfInUse = await this.userRepository.findOne({ where: { cpfHash } as any });
    if (cpfInUse) {
      await this.audit.log({ event: 'register_failure', req, detail: 'cpf_in_use' });
      throw new ConflictException('Não foi possível criar conta com esses dados');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const verification = this.createEmailVerificationToken();

    const user = this.userRepository.create({
      name: dto.name.trim().slice(0, 100),
      email,
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken: verification.hashedToken,
      emailVerificationExpires: verification.expires,
      ...(cpfHash && { cpfHash }),
      ...(dto.weightKg != null && { weightKg: dto.weightKg }),
      ...(dto.heightCm != null && { heightCm: dto.heightCm }),
      ...(dto.gender && { gender: dto.gender }),
    });

    await this.userRepository.save(user);
    await this.audit.log({ userId: user.id, event: 'register_success', req });
    const emailVerificationSent = await this.sendVerificationEmailSafe(user, verification.token);

    return {
      email,
      emailVerificationRequired: true,
      emailVerificationSent,
    };
  }

  // Login/cadastro via Google. Recebe o id_token do app, valida no Google e
  // cria/loga o usuário. Não precisa de lib extra (usa o endpoint tokeninfo).
  // Requer env GOOGLE_CLIENT_ID (audiência esperada). Enquanto não setado,
  // retorna erro claro — o botão no app fica desligado até configurar.
  async googleLogin(idToken: string, req?: Request) {
    const expectedAud = (process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!expectedAud) {
      throw new BadRequestException('Login com Google ainda não está configurado.');
    }
    if (!idToken || typeof idToken !== 'string') {
      throw new BadRequestException('Token do Google ausente.');
    }

    let payload: any;
    try {
      const resp = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
      if (!resp.ok) throw new Error('tokeninfo failed');
      payload = await resp.json();
    } catch {
      throw new UnauthorizedException('Não foi possível validar o login do Google.');
    }

    const audOk = payload.aud === expectedAud || (process.env.GOOGLE_CLIENT_IDS || '')
      .split(',').map((s) => s.trim()).filter(Boolean).includes(payload.aud);
    if (!audOk) {
      throw new UnauthorizedException('Token do Google não é deste app.');
    }
    const email = (payload.email || '').toLowerCase().trim();
    if (!email || payload.email_verified === 'false' || payload.email_verified === false) {
      throw new UnauthorizedException('E-mail do Google não verificado.');
    }

    const existing = await this.userRepository.findOne({ where: { email } });
    let user: User;
    if (!existing) {
      const randomPwd = await bcrypt.hash(`google-${payload.sub}-${email}`, BCRYPT_ROUNDS);
      const newUser: Partial<User> = {
        name: (payload.name || email.split('@')[0]).slice(0, 100),
        email,
        password: randomPwd,
        emailVerified: true,
        isVerified: true,
      };
      if (payload.picture) newUser.avatarUrl = payload.picture;
      user = this.userRepository.create(newUser);
      await this.userRepository.save(user);
      await this.audit.log({ userId: user.id, event: 'register_success', req, detail: 'google' });
    } else {
      user = existing;
      await this.audit.log({ userId: user.id, event: 'login_success', req, detail: 'google' });
    }

    return {
      user: this.publicUser(user),
      accessToken: this.generateToken(user),
    };
  }

  async login(dto: LoginDto, req?: Request) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .addSelect('user.failedLoginAttempts')
      .addSelect('user.lockedUntil')
      .where('user.email = :email', { email })
      .andWhere('user.deletedAt IS NULL') // bloqueia login de conta excluída (LGPD)
      .getOne();

    // Resposta genérica e timing constante: mesmo se user não existe,
    // gastamos tempo de bcrypt pra equalizar.
    if (!user) {
      await bcrypt.compare(dto.password, '$2b$12$' + 'x'.repeat(53));
      await this.audit.log({ event: 'login_failure', req, detail: 'unknown_email' });
      throw new UnauthorizedException(GENERIC_INVALID);
    }

    // Account locked?
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.log({ userId: user.id, event: 'login_failure', req, detail: 'account_locked' });
      throw new UnauthorizedException(
        `Conta temporariamente bloqueada. Tente novamente em alguns minutos.`,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const update: any = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
        update.failedLoginAttempts = 0;
        await this.audit.log({ userId: user.id, event: 'account_locked', req, detail: `attempts=${attempts}` });
      }
      await this.userRepository.update(user.id, update);
      await this.audit.log({ userId: user.id, event: 'login_failure', req });
      throw new UnauthorizedException(GENERIC_INVALID);
    }

    if (!user.emailVerified) {
      await this.audit.log({ userId: user.id, event: 'login_failure', req, detail: 'email_not_verified' });
      throw new ForbiddenException({
        statusCode: 403,
        code: 'EMAIL_NOT_VERIFIED',
        emailVerificationRequired: true,
        message: 'Confirme seu email para entrar',
        email: user.email,
      });
    }

    // Sucesso: reseta contadores
    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: this.getMaskedIp(req),
    });
    await this.audit.log({ userId: user.id, event: 'login_success', req });

    const token = this.generateToken(user);

    return {
      user: this.publicUser(user),
      accessToken: token,
    };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    return user;
  }

  async forgotPassword(email: string, req?: Request): Promise<{ message: string; resetToken?: string }> {
    const normalized = email.toLowerCase().trim();
    const user = await this.userRepository.findOne({ where: { email: normalized } });
    const genericMsg = 'Se o email existir, você receberá as instruções em breve.';

    if (!user) {
      await this.audit.log({ event: 'password_reset_requested', req, detail: 'unknown_email' });
      return { message: genericMsg };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.userRepository.update(user.id, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expires,
    });

    await this.audit.log({ userId: user.id, event: 'password_reset_requested', req });

    return {
      message: genericMsg,
      // Em dev expomos o token pra facilitar; prod requer email externo
      resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    };
  }

  async verifyEmail(token: string, req?: Request): Promise<{ ok: true; message: string }> {
    const hashedToken = this.hashToken(token);

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationToken')
      .addSelect('user.emailVerificationExpires')
      .where('user.emailVerificationToken = :token', { token: hashedToken })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Link de confirmacao invalido ou expirado');
    }

    await this.userRepository.update(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });
    await this.audit.log({ userId: user.id, event: 'email_verified', req });

    return { ok: true, message: 'Email confirmado com sucesso' };
  }

  async verifyEmailCode(email: string, code: string, req?: Request) {
    const normalized = email.toLowerCase().trim();
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.emailVerificationToken')
      .addSelect('user.emailVerificationExpires')
      .addSelect('user.emailVerificationAttempts')
      .where('user.email = :email', { email: normalized })
      .andWhere('user.deletedAt IS NULL')
      .getOne();

    if (!user || user.emailVerified) {
      throw new BadRequestException('Código inválido ou expirado');
    }
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new BadRequestException('Código inválido ou expirado');
    }
    if ((user.emailVerificationAttempts || 0) >= 5) {
      throw new BadRequestException('Muitas tentativas. Solicite um novo código.');
    }

    const candidateHash = this.hashToken(code);
    const storedHash = user.emailVerificationToken || '';
    const valid = storedHash.length === candidateHash.length && crypto.timingSafeEqual(
      Buffer.from(storedHash, 'utf8'),
      Buffer.from(candidateHash, 'utf8'),
    );
    if (!valid) {
      await this.userRepository.update(user.id, {
        emailVerificationAttempts: (user.emailVerificationAttempts || 0) + 1,
      });
      await this.audit.log({ userId: user.id, event: 'email_verification_failure', req });
      throw new BadRequestException('Código inválido ou expirado');
    }

    await this.userRepository.update(user.id, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      emailVerificationAttempts: 0,
    });
    user.emailVerified = true;
    await this.audit.log({ userId: user.id, event: 'email_verified', req });
    return { user: this.publicUser(user), accessToken: this.generateToken(user) };
  }

  async requestVerification(email: string, req?: Request): Promise<{ ok: true; message: string; emailVerificationSent?: boolean }> {
    const normalized = email.toLowerCase().trim();
    const user = await this.userRepository.findOne({ where: { email: normalized } });
    const generic = 'Se a conta estiver pendente, um novo código será enviado.';
    if (!user || user.emailVerified) return { ok: true, message: generic };

    const verification = this.createEmailVerificationToken();
    await this.userRepository.update(user.id, {
      emailVerificationToken: verification.hashedToken,
      emailVerificationExpires: verification.expires,
      emailVerificationAttempts: 0,
    });
    const emailVerificationSent = await this.sendVerificationEmailSafe(user, verification.token);
    await this.audit.log({ userId: user.id, event: 'email_verification_resent', req });
    return { ok: true, message: generic, emailVerificationSent };
  }

  async resendVerification(userId: string, req?: Request): Promise<{ ok: true; message: string; emailVerificationSent?: boolean }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    if (user.emailVerified) {
      return { ok: true, message: 'Email ja confirmado' };
    }

    const verification = this.createEmailVerificationToken();
    await this.userRepository.update(user.id, {
      emailVerificationToken: verification.hashedToken,
      emailVerificationExpires: verification.expires,
      emailVerificationAttempts: 0,
    });
    await this.audit.log({ userId: user.id, event: 'email_verification_resent', req });
    const emailVerificationSent = await this.sendVerificationEmailSafe(user, verification.token);

    return {
      ok: true,
      message: emailVerificationSent
        ? 'Email de confirmacao reenviado'
        : 'Nao foi possivel enviar o email de confirmacao agora',
      emailVerificationSent,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, req?: Request): Promise<void> {
    this.assertStrongPassword(newPassword);
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      await this.audit.log({ userId, event: 'login_failure', req, detail: 'change_password_wrong_current' });
      throw new BadRequestException('Senha atual incorreta');
    }
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.userRepository.update(userId, { password: hashedPassword });
    await this.audit.log({ userId, event: 'password_changed', req });
  }

  async resetPassword(token: string, newPassword: string, req?: Request): Promise<void> {
    this.assertStrongPassword(newPassword);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.resetPasswordToken')
      .addSelect('user.resetPasswordExpires')
      .where('user.resetPasswordToken = :token', { token: hashedToken })
      .getOne();

    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.userRepository.update(user.id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await this.audit.log({ userId: user.id, event: 'password_changed', req });
  }

  private generateToken(user: User): string {
    const payload = { sub: user.id, email: user.email };
    // 7 dias por padrão. Pra refresh rotation real, usar @nestjs/jwt com 2 tokens.
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  private publicUser(user: User) {
    // lat/long NÃO são expostos — apenas city para privacidade do usuário (LGPD)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      onboardingCompleted: user.onboardingCompleted,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      sports: user.sports,
      level: user.level,
      objectives: user.objectives,
      availability: user.availability,
      city: user.city,
      weightKg: user.weightKg,
      heightCm: user.heightCm,
      gender: user.gender,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  private createEmailVerificationToken(): { token: string; hashedToken: string; expires: Date } {
    const token = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    return {
      token,
      hashedToken: this.hashToken(token),
      expires: new Date(Date.now() + 10 * 60 * 1000),
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async sendVerificationEmailSafe(user: User, token: string): Promise<boolean> {
    try {
      this.logger.log(`Disparando email de verificacao para user=${user.id}`);
      await this.emailService.sendVerificationEmail(user.email, user.name, token);
      return true;
    } catch (error) {
      this.logger.error(
        `Falha ao enviar email de verificacao para user=${user.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /** Senha forte: mín 8 chars, ≥1 letra, ≥1 número, não em blacklist de óbvias. */
  private assertStrongPassword(pwd: string) {
    if (!pwd || pwd.length < 8) {
      throw new BadRequestException('Senha deve ter no mínimo 8 caracteres');
    }
    if (pwd.length > 128) {
      throw new BadRequestException('Senha muito longa (máx 128)');
    }
    if (!/[a-zA-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      throw new BadRequestException('Senha precisa conter letras e números');
    }
    const blacklist = [
      '12345678', 'password', 'qwerty12', '11111111', '00000000',
      'senha123', 'sync1234', 'abcd1234', 'password1', '123456789',
    ];
    if (blacklist.includes(pwd.toLowerCase())) {
      throw new BadRequestException('Senha muito comum — escolha uma mais segura');
    }
  }

  private getMaskedIp(req?: Request): string | null {
    if (!req) return null;
    const fwd = req.headers['x-forwarded-for'];
    const ip = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : req.socket?.remoteAddress) || '';
    if (!ip) return null;
    if (ip.includes(':')) return ip.split(':').slice(0, 4).join(':') + ':0:0:0:0';
    const parts = ip.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : ip;
  }
}
