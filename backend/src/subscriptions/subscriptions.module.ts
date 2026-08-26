import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { User } from '../users/entities/user.entity';
import { SubscriptionTransaction } from './subscription-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, SubscriptionTransaction])],
  controllers: [SubscriptionsController],
})
export class SubscriptionsModule {}
