import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(email: string, name: string, code: string): Promise<void> {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    const firstName = name.trim().split(/\s+/)[0] || 'atleta';
    const subject = `${code} é seu código de confirmação do Sync`;
    const html = this.verificationHtml(firstName, code);
    const text = `Oi, ${firstName}! Seu código de confirmação do Sync é ${code}. Ele expira em 10 minutos.`;

    if (apiKey) {
      const from = (process.env.EMAIL_FROM || '').trim();
      if (!from) throw new Error('EMAIL_FROM nao configurado');
      this.logger.log(`Enviando email de verificacao via Resend para ${email}`);
      await this.sendWithResend(apiKey, from, email, subject, html, text);
      this.logger.log(`Email de verificacao enviado via Resend para ${email}`);
      return;
    }

    if (this.hasSmtpConfig()) {
      const from = this.getSmtpFrom();
      this.logger.log(`Enviando email de verificacao via SMTP para ${email}`);
      await this.sendWithSmtp(from, email, subject, html, text);
      this.logger.log(`Email de verificacao enviado via SMTP para ${email}`);
      return;
    }

    throw new Error('Email nao configurado; defina RESEND_API_KEY e EMAIL_FROM');
  }

  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const firstName = name.trim().split(/\s+/)[0] || 'atleta';
    const configuredFrontend = (process.env.PUBLIC_WEB_URL || process.env.FRONTEND_URL || '')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    const frontendUrl = configuredFrontend || 'https://sync-2-0-blush.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const subject = 'Redefina sua senha do Sync';
    const html = this.passwordResetHtml(firstName, resetUrl);
    const text = `Oi, ${firstName}! Redefina sua senha do Sync neste link: ${resetUrl}. O link expira em 1 hora.`;

    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (apiKey) {
      const from = (process.env.EMAIL_FROM || '').trim();
      if (!from) throw new Error('EMAIL_FROM nao configurado');
      await this.sendWithResend(apiKey, from, email, subject, html, text);
      return;
    }

    if (this.hasSmtpConfig()) {
      await this.sendWithSmtp(this.getSmtpFrom(), email, subject, html, text);
      return;
    }

    throw new Error('Email nao configurado; defina RESEND_API_KEY e EMAIL_FROM');
  }

  private async sendWithResend(apiKey: string, from: string, to: string, subject: string, html: string, text: string): Promise<void> {
    const configuredTimeout = parseInt(process.env.RESEND_TIMEOUT_MS || '8000', 10);
    const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : 8000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html, text }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Resend falhou (${response.status}): ${detail.slice(0, 300)}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendWithSmtp(from: string, to: string, subject: string, html: string, text: string): Promise<void> {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = (process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false';
    const timeoutMs = parseInt(process.env.SMTP_TIMEOUT_MS || '8000', 10);
    const transporter = nodemailer.createTransport({
      host: (process.env.SMTP_HOST || 'smtp.gmail.com').trim(),
      port,
      secure,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
      family: 4,
      auth: {
        user: (process.env.SMTP_USER || '').trim(),
        pass: (process.env.SMTP_PASS || '').replace(/\s/g, ''),
      },
    } as nodemailer.TransportOptions);
    await transporter.verify();
    await transporter.sendMail({ from, to, subject, html, text });
  }

  private hasSmtpConfig(): boolean {
    return Boolean((process.env.SMTP_USER || '').trim() && (process.env.SMTP_PASS || '').trim());
  }

  private getSmtpFrom(): string {
    return (process.env.EMAIL_FROM || '').trim() || `Sync <${(process.env.SMTP_USER || '').trim()}>`;
  }

  private verificationHtml(firstName: string, code: string): string {
    return `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 24px;">Confirme seu email</h1>
        <p>Oi, ${this.escapeHtml(firstName)}. Digite este código no Sync:</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; background: #F3F4F6; padding: 16px; border-radius: 8px; text-align: center;">${code}</div>
        <p style="font-size: 13px; color: #6B7280;">O código expira em 10 minutos. Se você não criou uma conta, ignore este email.</p>
      </div>`;
  }

  private passwordResetHtml(firstName: string, resetUrl: string): string {
    const safeUrl = this.escapeHtml(resetUrl);
    return `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 24px;">Redefina sua senha</h1>
        <p>Oi, ${this.escapeHtml(firstName)}. Recebemos um pedido para alterar a senha da sua conta Sync.</p>
        <p><a href="${safeUrl}" style="display:inline-block;background:#FF6B35;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Criar nova senha</a></p>
        <p style="font-size: 13px; color: #6B7280;">O link expira em 1 hora e só pode ser usado uma vez. Se você não fez o pedido, ignore este email.</p>
      </div>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
}
