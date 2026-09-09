import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { AchievementsService } from './achievements.service';

@Injectable()
export class AchievementsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AchievementsInterceptor.name);
  constructor(private readonly achievements: AchievementsService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest();
    const path = (request.originalUrl || request.url || '').split('?')[0];
    const eligible = request.user?.id && ['POST', 'PUT'].includes(request.method) && (
      /^\/api\/(stories|events|matching\/swipe|chat\/messages|users\/onboarding|users\/me)$/.test(path) ||
      /^\/api\/(feed\/[^/]+\/comments|activities\/[^/]+\/(kudos|comments)|events\/[^/]+\/comments)$/.test(path));
    if (!eligible) return next.handle();
    // Only successful writes trigger reconciliation. Failure cannot undo the original operation.
    return next.handle().pipe(tap(() => {
      void this.achievements.checkAndUnlock(request.user.id).catch(() => this.logger.warn('Conquista será reconciliada na próxima consulta'));
    }));
  }
}
