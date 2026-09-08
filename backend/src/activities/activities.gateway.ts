import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Activity } from './entities/activity.entity';
import { ActivityPoint } from './entities/activity-point.entity';
import { haversineMeters } from '../common/utils/haversine';

// Gateway WebSocket para tracking em tempo real
// Eventos:
//  - joinActivity { activityId } → entra na sala daquela atividade
//  - point { activityId, lat, lng, alt?, timestamp } → atleta streama posição
//  - livePoint (broadcast) → seguidores recebem em tempo real
//  - finishActivity → fecha a sala
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
      : process.env.NODE_ENV === 'production'
        ? false
        : true,
    credentials: false,
  },
  namespace: '/tracking',
})
export class ActivitiesGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ActivitiesGateway.name);

  // userId por socket após autenticação
  private socketUser: Map<string, string> = new Map();
  // Atividades que o socket pode escrever (owner verificado)
  private socketActivities: Map<string, Set<string>> = new Map();

  // Buffer de pontos por atividade para persistência em batch (reduz writes no SQLite)
  private pointBuffer: Map<string, { lat: number; lng: number; alt?: number; segmentStart: boolean; ts: Date }[]> = new Map();
  private flushInFlight: Map<string, Promise<void>> = new Map();
  // Cache do último ponto por atividade (para snapshot ao novo seguidor)
  private lastPoint: Map<string, { lat: number; lng: number; ts: Date; distance: number }> = new Map();

  private flushInterval?: NodeJS.Timeout;

  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(ActivityPoint)
    private readonly pointRepository: Repository<ActivityPoint>,
    private readonly jwtService: JwtService,
  ) {}

  afterInit() {
    // Persiste buffer a cada 3s, somente depois que o gateway está pronto.
    this.flushInterval = setInterval(() => this.flushBuffers().catch(() => undefined), 3000);
  }

  onModuleDestroy() {
    if (this.flushInterval) clearInterval(this.flushInterval);
  }

  async handleConnection(client: Socket) {
    // Autenticação por JWT no handshake.
    // SECURITY: token lido APENAS de handshake.auth — nunca de query params
    // (query params ficam em access logs do servidor e no histórico do browser).
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      // Anônimos podem APENAS observar (joinActivity em modo read-only)
      // — qualquer envio de 'point' será rejeitado.
      return;
    }
    try {
      const payload: any = this.jwtService.verify(token);
      if (payload?.sub) {
        this.socketUser.set(client.id, payload.sub);
      }
    } catch {
      // Token inválido — desconecta
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.socketUser.delete(client.id);
    this.socketActivities.delete(client.id);
  }

  @SubscribeMessage('joinActivity')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { activityId: string; liveToken?: string },
  ) {
    if (!data?.activityId) return { ok: false };

    const activity = await this.activityRepository.findOne({
      where: { id: data.activityId },
      select: ['id', 'user_id', 'liveToken', 'liveTokenExpiresAt'],
    });
    if (!activity) return { ok: false, error: 'not_found' };

    const userId = this.socketUser.get(client.id);
    const isOwner = Boolean(userId && activity.user_id === userId);
    const hasValidPublicToken = Boolean(
      data.liveToken &&
      activity.liveToken &&
      data.liveToken === activity.liveToken &&
      activity.liveTokenExpiresAt && activity.liveTokenExpiresAt > new Date(),
    );
    if (!isOwner && !hasValidPublicToken) {
      return { ok: false, error: 'forbidden' };
    }

    const room = isOwner ? `activity:${data.activityId}` : `live:${data.activityId}:${activity.liveToken}`;
    await client.join(room);

    // Envia snapshot dos pontos já existentes ao novo seguidor
    const last = this.lastPoint.get(data.activityId);
    if (last) {
      client.emit('livePoint', {
        activityId: data.activityId,
        latitude: last.lat,
        longitude: last.lng,
        timestamp: last.ts.toISOString(),
        distance: last.distance,
        snapshot: true,
      });
    }
    return { ok: true, room: `activity:${data.activityId}` };
  }

  @SubscribeMessage('point')
  async onPoint(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      activityId: string;
      latitude: number;
      longitude: number;
      altitude?: number;
      segmentStart?: boolean;
      timestamp?: string;
    },
  ) {
    try {
      if (!data?.activityId) return { ok: false };

      // ===== AUTH CHECK =====
      // Só o dono da atividade pode enviar pontos.
      const userId = this.socketUser.get(client.id);
      if (!userId) return { ok: false, error: 'unauthenticated' };

      // Cache de verificação por socket+atividade
      let owned = this.socketActivities.get(client.id);
      if (!owned) {
        owned = new Set();
        this.socketActivities.set(client.id, owned);
      }
      {
        const activity = await this.activityRepository.findOne({
          where: { id: data.activityId },
          select: ['id', 'user_id', 'isCompleted'],
        });
        if (!activity || activity.user_id !== userId) {
          return { ok: false, error: 'forbidden' };
        }
        if (activity.isCompleted) {
          return { ok: false, error: 'activity_completed' };
        }
        owned.add(data.activityId);
      }
      // Sanity check coordenadas
      if (
        !Number.isFinite(data.latitude) || data.latitude < -90 || data.latitude > 90 ||
        !Number.isFinite(data.longitude) || data.longitude < -180 || data.longitude > 180
      ) {
        return { ok: false, error: 'invalid coords' };
      }
      const ts = data.timestamp ? new Date(data.timestamp) : new Date();
      if (Number.isNaN(ts.getTime())) return { ok: false, error: 'invalid timestamp' };

      // Atualiza distância acumulada baseado no último ponto
      const prev = this.lastPoint.get(data.activityId);
      let distance = prev?.distance ?? 0;
      if (prev && !data.segmentStart) {
        distance += haversineMeters(prev.lat, prev.lng, data.latitude, data.longitude);
      }
      this.lastPoint.set(data.activityId, {
        lat: data.latitude,
        lng: data.longitude,
        ts,
        distance,
      });

      // Adiciona ao buffer (persistido em batch)
      const buf = this.pointBuffer.get(data.activityId) || [];
      buf.push({
        lat: data.latitude,
        lng: data.longitude,
        alt: data.altitude,
        segmentStart: Boolean(data.segmentStart),
        ts,
      });
      this.pointBuffer.set(data.activityId, buf);

      // Broadcast pra seguidores na sala
      await this.broadcastLive(data.activityId, 'livePoint', {
        activityId: data.activityId,
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        segmentStart: Boolean(data.segmentStart),
        timestamp: ts.toISOString(),
        distance,
      });

      return { ok: true };
    } catch (err) {
      this.logger.error(`erro em point: ${(err as Error)?.message ?? err}`);
      return { ok: false };
    }
  }

  @SubscribeMessage('finishActivity')
  async onFinish(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { activityId: string },
  ) {
    if (!data?.activityId) return { ok: false };
    // Ownership check — só o dono pode finalizar a atividade via socket
    const userId = this.socketUser.get(client.id);
    if (!userId) return { ok: false, error: 'unauthenticated' };
    const activity = await this.activityRepository.findOne({
      where: { id: data.activityId },
      select: ['id', 'user_id'],
    });
    if (!activity || activity.user_id !== userId) {
      return { ok: false, error: 'forbidden' };
    }
    try {
      await this.flushActivity(data.activityId);
    } catch {
      return { ok: false, error: 'flush_failed' };
    }
    // Confirma apenas o flush; o treino só terminou quando o REST persistiu.
    return { ok: true };
  }

  /** Atualiza observadores públicos quando o cronômetro pausa ou retoma. */
  async broadcastTiming(
    activityId: string,
    timing: { paused: boolean; pausedAt: string | null; pausedDuration: number },
  ) {
    await this.broadcastLive(activityId, 'activityTiming', {
      activityId,
      ...timing,
    });
  }

  async broadcastFinished(activityId: string) {
    await this.broadcastLive(activityId, 'activityFinished', { activityId });
    this.lastPoint.delete(activityId);
  }

  private async broadcastLive(activityId: string, event: string, payload: unknown) {
    this.server.to(`activity:${activityId}`).emit(event, payload);
    const activity = await this.activityRepository.findOne({
      where: { id: activityId }, select: ['id', 'liveToken', 'liveTokenExpiresAt'],
    });
    // Sala por token: revogação/expiração impede novos dados até mesmo para
    // observadores já conectados. Um novo link não reautoriza o link antigo.
    if (activity?.liveToken && activity.liveTokenExpiresAt && +activity.liveTokenExpiresAt > Date.now()) {
      this.server.to(`live:${activityId}:${activity.liveToken}`).emit(event, payload);
    }
  }

  /** Garante que o endpoint REST finalize somente depois do buffer WebSocket. */
  async flushOwnedActivity(activityId: string, userId: string): Promise<void> {
    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
      select: ['id', 'user_id'],
    });
    if (!activity || activity.user_id !== userId) {
      throw new NotFoundException('Atividade não encontrada');
    }
    await this.flushActivity(activityId);
  }

  private async flushBuffers() {
    for (const activityId of [...this.pointBuffer.keys()]) {
      await this.flushActivity(activityId);
    }
  }

  private async flushActivity(activityId: string) {
    const currentFlush = this.flushInFlight.get(activityId);
    if (currentFlush) return currentFlush;

    const flush = this.drainActivityBuffer(activityId);
    this.flushInFlight.set(activityId, flush);

    try {
      await flush;
    } finally {
      this.flushInFlight.delete(activityId);
    }
  }

  private async drainActivityBuffer(activityId: string): Promise<void> {
    while (this.pointBuffer.get(activityId)?.length) {
      const buf = this.pointBuffer.get(activityId)!;
      this.pointBuffer.delete(activityId);
      try {
        const rows = buf.map((p) =>
          this.pointRepository.create({
            activity_id: activityId,
            latitude: p.lat,
            longitude: p.lng,
            altitude: p.alt,
            segmentStart: p.segmentStart,
            timestamp: p.ts,
          }),
        );
        await this.pointRepository.save(rows);
      } catch (err) {
        const pending = this.pointBuffer.get(activityId) || [];
        this.pointBuffer.set(activityId, [...buf, ...pending]);
        this.logger.error(`flush falhou: ${(err as Error)?.message ?? err}`);
        throw err;
      }
    }
  }
}
