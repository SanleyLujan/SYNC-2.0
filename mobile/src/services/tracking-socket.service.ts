// Socket dedicado para streaming GPS em tempo real (namespace /tracking).
// Separado do chat para isolar reconnects e não competir por bandwidth.
import { io, Socket } from 'socket.io-client';
import api, { API_HOST } from './api';
import { secureStorage } from './secure-storage';

const TRACKING_URL = `${API_HOST}/tracking`;

export type LivePoint = {
  activityId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  segmentStart?: boolean;
  timestamp: string;
  distance: number;
  snapshot?: boolean;
};

export type LiveTiming = {
  activityId: string;
  paused: boolean;
  pausedAt: string | null;
  pausedDuration: number;
};

export class TrackingSocketService {
  private socket: Socket | null = null;
  constructor(private readonly publicObserver = false) {}

  private async loadToken(): Promise<string | null> {
    try {
      if (this.publicObserver) return null;
      // Permite ao interceptor renovar um JWT vencido antes do handshake.
      await api.get('/users/me');
      return await secureStorage.getItem('@sync:token');
    } catch {
      return null;
    }
  }

  connect(): Socket {
    if (this.socket) return this.socket;
    this.socket = io(TRACKING_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 10000,
      auth: (cb) => {
        // Lê token do SecureStore (assíncrono) e envia no handshake.
        // Backend valida JWT pra autorizar envio de pontos.
        this.loadToken().then((t) => cb(t ? { token: t } : {}));
      },
    });
    return this.socket;
  }

  // Para o atleta: começa a streamar pontos da sua própria atividade
  startBroadcasting(activityId: string) {
    const s = this.connect();
    const join = () => s.emit('joinActivity', { activityId });
    s.on('connect', join);
    if (s.connected) join();
  }

  // Para seguidor (com token público): entra na sala daquela atividade
  follow(
    activityId: string,
    liveToken: string,
    onPoint: (p: LivePoint) => void,
    onFinished?: () => void,
    onTiming?: (timing: LiveTiming) => void,
    onConnection?: (connected: boolean) => void,
  ) {
    const s = this.connect();
    s.off('livePoint');
    s.on('livePoint', onPoint);
    if (onFinished) {
      s.off('activityFinished');
      s.on('activityFinished', onFinished);
    }
    if (onTiming) {
      s.off('activityTiming');
      s.on('activityTiming', onTiming);
    }
    // Registra listeners antes do join para não perder o snapshot quando o
    // socket já está conectado e o servidor responde imediatamente.
    const join = () => {
      s.emit('joinActivity', { activityId, liveToken }, (reply: { ok?: boolean }) => onConnection?.(reply?.ok === true));
    };
    const disconnected = () => onConnection?.(false);
    s.on('connect', join);
    s.on('disconnect', disconnected);
    s.on('connect_error', disconnected);
    if (s.connected) join();
    return () => {
      s.off('connect', join);
      s.off('disconnect', disconnected);
      s.off('connect_error', disconnected);
      s.off('livePoint', onPoint);
      if (onFinished) s.off('activityFinished', onFinished);
      if (onTiming) s.off('activityTiming', onTiming);
    };
  }

  // Atleta envia ponto
  sendPoint(p: {
    activityId: string;
    latitude: number;
    longitude: number;
    altitude?: number;
    segmentStart?: boolean;
    timestamp?: string;
  }) {
    if (!this.socket) this.connect();
    this.socket?.emit('point', p);
  }

  async finish(activityId: string): Promise<void> {
    const socket = this.socket;
    if (!socket?.connected) throw new Error('Tracking socket desconectado');
    const response = await (socket as any).timeout(10_000).emitWithAck('finishActivity', { activityId });
    if (!response?.ok) throw new Error(response?.error || 'Não foi possível confirmar os pontos GPS');
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const trackingSocket = new TrackingSocketService();
// Observador nunca envia JWT de uma conta armazenada nem divide o socket do atleta.
export const liveTrackingSocket = new TrackingSocketService(true);
