// Subscription tier endpoints. Stripe-ready (placeholder, sem cobrança real ainda).
import { Controller, Get, Post, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { SubscriptionTransaction } from './subscription-transaction.entity';

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['Tracking GPS ilimitado', 'Match e chat', 'Stories', 'Grupos públicos', 'Daily quests', 'Audio coach básico'],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 19,
    features: ['Tudo do Free', 'Pace zones detalhadas', 'Stats avançadas', 'Planos de treino', 'Heatmap personalizado', 'Sem anúncios'],
  },
  atleta_pro: {
    id: 'atleta_pro',
    name: 'Atleta Pro',
    price: 39,
    features: ['Tudo do Premium', 'IA Coach', 'Análise overtraining', 'Segments KOM/QOM', 'Integração Strava/Garmin', 'Live streaming'],
  },
};

@ApiTags('Subscriptions')
@Controller('api/subscriptions')
export class SubscriptionsController {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(SubscriptionTransaction) private readonly txRepo: Repository<SubscriptionTransaction>,
  ) {}

  private isDemoEnabled() {
    return process.env.NODE_ENV !== 'production' && process.env.SUBSCRIPTION_DEMO === 'true';
  }

  @Get('plans')
  @ApiOperation({ summary: 'Listar planos disponíveis' })
  plans() {
    return Object.values(PLANS);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Meu plano atual' })
  async me(@CurrentUser() user: User) {
    const full = await this.userRepo.findOne({ where: { id: user.id } });
    const expiresAt = full?.subscriptionExpiresAt || null;
    const isActive = !expiresAt || expiresAt > new Date();
    const tier = (isActive ? full?.subscriptionTier || 'free' : 'free') as keyof typeof PLANS;
    return {
      currentTier: tier,
      plan: PLANS[tier] || PLANS.free,
      expiresAt,
      isActive,
    };
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade pra Premium ou Pro em modo demonstração' })
  async upgrade(@CurrentUser() user: User, @Body() body: { tier: 'premium' | 'atleta_pro' }) {
    if (!this.isDemoEnabled()) {
      throw new BadRequestException('Pagamento não configurado. Ative um provedor de pagamentos antes de liberar assinaturas.');
    }
    const validTiers = ['premium', 'atleta_pro'];
    if (!validTiers.includes(body.tier)) {
      return { error: 'Tier inválido', validTiers };
    }
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias
    const plan = PLANS[body.tier];
    const tx = await this.txRepo.save(this.txRepo.create({
      user_id: user.id,
      tier: body.tier,
      amountCents: plan.price * 100,
      status: 'paid',
      paidAt: new Date(),
    }));
    await this.userRepo.update(user.id, {
      subscriptionTier: body.tier,
      subscriptionExpiresAt: expiresAt,
    });
    return {
      ok: true,
      message: `Upgrade pra ${body.tier} feito! Válido por 30 dias.`,
      tier: body.tier,
      expiresAt,
      transactionId: tx.id,
    };
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar checkout local de assinatura' })
  async checkout(@CurrentUser() user: User, @Body() body: { tier: 'premium' | 'atleta_pro' }) {
    if (!this.isDemoEnabled()) {
      throw new BadRequestException('Checkout de demonstração desativado. Configure um provedor de pagamentos.');
    }
    const plan = PLANS[body.tier];
    if (!plan) {
      return { error: 'Tier inválido', validTiers: ['premium', 'atleta_pro'] };
    }
    const tx = await this.txRepo.save(this.txRepo.create({
      user_id: user.id,
      tier: body.tier,
      amountCents: plan.price * 100,
      status: 'pending',
      paidAt: null,
    }));
    return {
      checkoutId: tx.id,
      tier: body.tier,
      amountCents: tx.amountCents,
      provider: 'local_demo',
    };
  }

  @Post('checkout/:id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar pagamento local da assinatura' })
  async confirmCheckout(@CurrentUser() user: User, @Param('id') id: string) {
    if (!this.isDemoEnabled()) {
      throw new BadRequestException('Confirmação local desativada fora do modo de demonstração.');
    }
    const tx = await this.txRepo.findOne({ where: { id, user_id: user.id } });
    if (!tx) return { error: 'checkout_not_found' };
    if (tx.status !== 'paid') {
      tx.status = 'paid';
      tx.paidAt = new Date();
      await this.txRepo.save(tx);
    }
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.userRepo.update(user.id, {
      subscriptionTier: tx.tier,
      subscriptionExpiresAt: expiresAt,
    });
    return { ok: true, tier: tx.tier, expiresAt, transactionId: tx.id };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Histórico de assinaturas e pagamentos' })
  history(@CurrentUser() user: User) {
    return this.txRepo.find({
      where: { user_id: user.id },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  @Post('stripe/webhook')
  @ApiOperation({ summary: 'Webhook Stripe (stub — precisa STRIPE_SECRET_KEY)' })
  async stripeWebhook(@Body() body: any) {
    throw new BadRequestException('Webhook Stripe ainda não foi implementado com verificação de assinatura.');
  }

  @Post('stripe/checkout')
  @ApiOperation({ summary: 'Criar Stripe Checkout Session (stub)' })
  async stripeCheckout(@Body() body: { tier: 'premium' | 'atleta_pro' }) {
    throw new BadRequestException('Checkout Stripe ainda não foi implementado.');
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar assinatura' })
  async cancel(@CurrentUser() user: User) {
    await this.userRepo.update(user.id, {
      subscriptionTier: 'free',
      subscriptionExpiresAt: null,
    });
    return { ok: true, message: 'Assinatura cancelada. Você voltou pro plano Free.' };
  }
}
