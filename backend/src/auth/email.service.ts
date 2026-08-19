import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    const from = (process.env.EMAIL_FROM || 'Sync <noreply@sync.app>').trim();
    const frontendUrl = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
    const baseUrl = frontendUrl || 'https://sync-2-0-blush.vercel.app';
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    if (!apiKey) {
      this.logger.warn(`RESEND_API_KEY ausente; link de verificacao para ${email}: ${verifyUrl}`);
      return;
    }

    const firstName = name.trim().split(/\s+/)[0] || 'atleta';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: 'Confirme seu email no Sync',
        html: this.verificationHtml(firstName, verifyUrl),
        text: `Oi, ${firstName}! Confirme seu email no Sync: ${verifyUrl}`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend falhou (${response.status}): ${detail.slice(0, 300)}`);
    }
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
