// Socket dedicado para streaming GPS em tempo real (namespace /tracking).
// Separado do chat para isolar reconnects e não competir por bandwidth.
import { io, Socket } from 'socket.io-client';
import { API_HOST } from './api';
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

class TrackingSocketService {
  private socket: Socket | null = null;

  private async loadToken(): Promise<string | null> {
    try {
      return await secureStorage.getItem('@sync:token');
    } catch {
      return null;
    }
  }

  connect(): Socket {
    if (this.socket?.connected) return this.socket;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
    }
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
    s.emit('joinActivity', { activityId });
  }

  // Para seguidor (com token público): entra na sala daquela atividade
  follow(
    activityId: string,
    liveToken: string,
    onPoint: (p: LivePoint) => void,
    onFinished?: () => void,
    onTiming?: (timing: LiveTiming) => void,
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
    s.emit('joinActivity', { activityId, liveToken });
    return () => {
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
