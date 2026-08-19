import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    const from = (process.env.EMAIL_FROM || 'Sync <noreply@sync.app>').trim();
    const frontendUrl = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
    const baseUrl = frontendUrl || 'https://sync-2-0-blush.vercel.app';
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const firstName = name.trim().split(/\s+/)[0] || 'atleta';
    const subject = 'Confirme seu email no Sync';
    const html = this.verificationHtml(firstName, verifyUrl);
    const text = `Oi, ${firstName}! Confirme seu email no Sync: ${verifyUrl}`;

    if (apiKey) {
      this.logger.log(`Enviando email de verificacao via Resend para ${email}`);
      await this.sendWithResend(apiKey, from, email, subject, html, text);
      this.logger.log(`Email de verificacao enviado via Resend para ${email}`);
      return;
    }

    if (this.hasSmtpConfig()) {
      this.logger.log(`Enviando email de verificacao via SMTP para ${email}`);
      await this.sendWithSmtp(from, email, subject, html, text);
      this.logger.log(`Email de verificacao enviado via SMTP para ${email}`);
      return;
    }

    throw new Error(`Email nao configurado; defina RESEND_API_KEY ou SMTP_HOST/SMTP_USER/SMTP_PASS. Link gerado para ${email}: ${verifyUrl}`);
  }

  private async sendWithResend(
    apiKey: string,
    from: string,
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend falhou (${response.status}): ${detail.slice(0, 300)}`);
    }
  }

  private async sendWithSmtp(
    from: string,
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<void> {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = (process.env.SMTP_SECURE || 'true').toLowerCase() !== 'false';
    const timeoutMs = parseInt(process.env.SMTP_TIMEOUT_MS || '15000', 10);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({ from, to, subject, html, text });
  }

  private hasSmtpConfig(): boolean {
    return Boolean(
      (process.env.SMTP_HOST || '').trim() &&
      (process.env.SMTP_USER || '').trim() &&
      (process.env.SMTP_PASS || '').trim(),
    );
  }

  private verificationHtml(firstName: string, verifyUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 24px;">Confirme seu email</h1>
        <p>Oi, ${this.escapeHtml(firstName)}. Falta só confirmar este endereço para manter sua conta Sync protegida.</p>
        <p>
          <a href="${verifyUrl}" style="display: inline-block; background: #22C55E; color: #07120A; padding: 12px 18px; border-radius: 8px; font-weight: 700; text-decoration: none;">
            Confirmar email
          </a>
        </p>
        <p style="font-size: 13px; color: #6B7280;">Este link expira em 24 horas. Se você não criou uma conta, pode ignorar este email.</p>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
