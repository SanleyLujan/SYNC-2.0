import { Controller, Get, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { StatsPeriod } from './stats-rules';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Stats')
@Controller('api/stats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'Estatísticas completas do usuário' })
  async getUserStats(@CurrentUser() user: User, @Query('period') period: StatsPeriod = 'all', @Query('version') version = '1') {
    if (!['all', 'week', 'month', 'year'].includes(period)) throw new BadRequestException('Período inválido');
    if (!['1', '2'].includes(version)) throw new BadRequestException('Versão inválida');
    const stats = await this.statsService.getUserStats(user.id, period);
    if (version === '2') return stats;
    // Old cached PWA bundles still expect kilometers/hours. Do not change their contract during rollout.
    return { ...stats, schemaVersion: 1, units: { ...stats.units, distance: 'km', duration: 'h' },
      totalDistance: stats.totalDistance / 1000, totalDuration: stats.totalDuration / 3600,
      longestActivity: stats.longestActivity ? { ...stats.longestActivity, distance: stats.longestActivity.distance / 1000 } : null,
      sportBreakdown: stats.sportBreakdown.map(r => ({ ...r, totalDistance: r.totalDistance / 1000, totalDuration: r.totalDuration / 3600 })),
      weeklyStats: stats.weeklyStats.map(r => ({ ...r, distance: r.distance / 1000, duration: r.duration / 3600 })),
      monthlyStats: stats.monthlyStats.map(r => ({ ...r, distance: r.distance / 1000, duration: r.duration / 3600 })),
    };
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Resumo semanal do usuário' })
  async getWeeklySummary(@CurrentUser() user: User, @Query('version') version = '1') {
    const rows = await this.statsService.getWeeklySummary(user.id);
    return version === '2' ? rows : rows.map(r => ({ ...r, distance: r.distance / 1000, duration: r.duration / 3600 }));
  }
}
