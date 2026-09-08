import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsUUID, IsString, IsNumber, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ChallengesService } from './challenges.service';

class CreateChallengeDto {
  @IsUUID() challengedId: string;
  @IsString() sport: string;
  @IsString() metric: string;
  @IsNumber() target: number;
  @IsOptional() @IsInt() expiresInDays?: number;
}
class RespondChallengeDto { @IsBoolean() accept: boolean; }

@ApiTags('Challenges')
@Controller('api/challenges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChallengesController {
  constructor(private readonly svc: ChallengesService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Criar um desafio para outro usuário' })
  create(
    @CurrentUser() user: User,
    @Body() body: CreateChallengeDto,
  ) {
    return this.svc.create(user.id, body);
  }

  @Get()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Listar meus desafios (enviados + recebidos)' })
  list(@CurrentUser() user: User) {
    return this.svc.list(user.id);
  }

  @Patch(':id/respond')
  @ApiOperation({ summary: 'Aceitar ou recusar um desafio' })
  respond(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RespondChallengeDto,
  ) {
    return this.svc.respond(user.id, id, body.accept);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Legado: conclusão manual não permitida' })
  complete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.complete(user.id, id);
  }
  @Get('peers') peers(@CurrentUser() user: User) { return this.svc.peers(user.id); }
}
