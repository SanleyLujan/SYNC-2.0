import { io, Socket } from 'socket.io-client';
import { secureStorage } from './secure-storage';
import { API_HOST } from './api';

// Deriva o namespace do host da API (mesmo servidor, porta 3000)
const SOCKET_URL = `${API_HOST}/chat`;

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 20000; // teto do backoff — nunca desiste de vez

export type SocketStatus = 'connected' | 'connecting' | 'disconnected';

type Handler = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private jwtToken: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private status: SocketStatus = 'disconnected';
  private appActive = false;
  private generation = 0;
  private connecting: Promise<Socket> | null = null;
  private cancelConnection: (() => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // Handlers registrados pela UI — re-vinculados a CADA novo socket pra que a
  // conversa não "morra" depois de uma reconexão (bug clássico: o listener
  // ficava no socket antigo).
  private handlers: Record<string, Handler | undefined> = {};
  // Salas em que o usuário está — re-entramos automaticamente ao reconectar.
  private joinedRooms = new Set<string>();
  // Observadores de status (banner "reconectando…", etc.)
  private statusListeners = new Set<(s: SocketStatus) => void>();

  /**
   * Conecta ao gateway de chat autenticando via JWT.
   * O userId é extraído do token pelo servidor — não é enviado pelo cliente.
   */
  connect(): Promise<Socket> {
    if (!this.appActive) return Promise.reject(new Error('App em segundo plano'));
    if (this.socket?.connected) return Promise.resolve(this.socket);
    if (this.connecting) return this.connecting;
    const attempt = this.connectWithToken(this.generation);
    this.connecting = attempt;
    const clear = () => { if (this.connecting === attempt) this.connecting = null; };
    void attempt.then(clear, clear);
    return attempt;
  }

  private async connectWithToken(generation: number): Promise<Socket> {
    const token = await secureStorage.getItem('@sync:token');
    if (!this.appActive || generation !== this.generation) throw new Error('Conexão cancelada');
    if (!token) throw new Error('Não autenticado — faça login antes de conectar ao chat');
    this.jwtToken = token;
    return this.createConnection(token);
  }

  /** Foreground state is owned by the authenticated app, not by an open chat. */
  setAppActive(active: boolean) {
    if (this.appActive === active) return;
    this.appActive = active;
    if (active) {
      this.reconnectAttempts = 0;
      void this.connect().catch(() => {});
    } else this.stopTransport();
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private stopTransport() {
    this.generation++;
    this.cancelConnection?.();
    this.cancelConnection = null;
    this.connecting = null;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus('disconnected');
  }

  private setStatus(s: SocketStatus) {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach((fn) => {
      try { fn(s); } catch { /* noop */ }
    });
  }

  getStatus(): SocketStatus {
    return this.status;
  }

  /** Inscreve um observador no status de conexão. Retorna função de unsubscribe. */
  onStatusChange(fn: (s: SocketStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status); // emite o estado atual de imediato
    return () => this.statusListeners.delete(fn);
  }

  private createConnection(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      this.cancelConnection = () => reject(new Error('Conexão cancelada'));
      this.stopHeartbeat();
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      }

      this.setStatus('connecting');

      const socket = io(SOCKET_URL, {
        // SECURITY: JWT no handshake.auth, nunca em query params (evita logging em proxies)
        auth: { token },
        // websocket primeiro; cai pra polling se o upgrade WS falhar atrás do
        // proxy do Render (evita "falha de conexão" no chat)
        transports: ['websocket', 'polling'],
        reconnection: false, // gerenciamos manualmente com backoff exponencial
        timeout: 10000,
      });
      this.socket = socket;

      socket.on('connect', () => {
        if (this.socket !== socket || !this.appActive) return;
        this.cancelConnection = null;
        this.reconnectAttempts = 0;
        this.stopHeartbeat();
        socket.emit('presenceHeartbeat');
        this.heartbeatTimer = setInterval(() => {
          if (this.appActive && socket.connected) socket.emit('presenceHeartbeat');
        }, 15_000);
        // Re-vincula handlers e re-entra nas salas — chave pra reconexão funcionar
        this.rebindHandlers();
        this.joinedRooms.forEach((matchId) => {
          this.socket?.emit('joinChat', { matchId });
        });
        this.setStatus('connected');
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        if (this.socket !== socket) return;
        this.cancelConnection = null;
        this.stopHeartbeat();
        this.setStatus('disconnected');
        reject(err);
        this.scheduleReconnect();
      });

      socket.on('disconnect', () => {
        if (this.socket !== socket) return;
        this.cancelConnection = null;
        this.stopHeartbeat();
        reject(new Error('Conexão encerrada'));
        this.setStatus('disconnected');
        this.scheduleReconnect();
      });

      // Servidor nos expulsa se o token expirar
      socket.on('auth_error', () => {
        if (this.socket !== socket) return;
        reject(new Error('Sessão expirada'));
        this.jwtToken = null;
        this.disconnect();
      });
    });
  }

  /** Re-aplica todos os handlers guardados ao socket atual. */
  private rebindHandlers() {
    if (!this.socket) return;
    for (const [event, handler] of Object.entries(this.handlers)) {
      if (!handler) continue;
      this.socket.off(event);
      this.socket.on(event, handler);
    }
  }

  private scheduleReconnect() {
    if (!this.jwtToken || !this.appActive) return;
    if (this.reconnectTimer) return;

    // Backoff exponencial com teto — tenta pra sempre (até desconectar de vez)
    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => {});
    }, delay);
  }

  /** Força uma reconexão imediata (ex.: quando a rede volta). */
  reconnectNow() {
    if (!this.appActive || !this.jwtToken || this.socket?.connected) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    void this.connect().catch(() => {});
  }

  joinChat(matchId: string) {
    this.joinedRooms.add(matchId);
    this.socket?.emit('joinChat', { matchId });
  }

  /** senderId is derived server-side from the JWT — do not pass it */
  sendMessage(matchId: string, content: string) {
    this.socket?.emit('sendMessage', { matchId, content });
  }

  sendTypedMessage(matchId: string, content: string, type: 'text' | 'audio' | 'image' | 'location') {
    this.socket?.emit('sendMessage', { matchId, content, type });
  }

  onNewMessage(callback: (message: any) => void) {
    this.handlers['newMessage'] = callback;
    this.socket?.off('newMessage');
    this.socket?.on('newMessage', callback);
  }

  onTyping(callback: (data: { userId: string }) => void) {
    this.handlers['userTyping'] = callback;
    this.socket?.off('userTyping');
    this.socket?.on('userTyping', callback);
  }

  /** userId is derived server-side from the JWT — do not pass it */
  emitTyping(matchId: string) {
    this.socket?.emit('typing', { matchId });
  }

  /** Alterna uma reação (emoji) numa mensagem. */
  reactMessage(matchId: string, messageId: string, emoji: string) {
    this.socket?.emit('reactMessage', { matchId, messageId, emoji });
  }

  /** Ouve atualizações de reações (mapa emoji -> userIds). */
  onMessageReaction(callback: (data: { messageId: string; reactions: Record<string, string[]> }) => void) {
    this.handlers['messageReaction'] = callback;
    this.socket?.off('messageReaction');
    this.socket?.on('messageReaction', callback);
  }

  onUserOnline(callback: (data: { userId: string }) => void) {
    this.handlers['userOnline'] = callback;
    this.socket?.off('userOnline');
    this.socket?.on('userOnline', callback);
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    this.handlers['userOffline'] = callback;
    this.socket?.off('userOffline');
    this.socket?.on('userOffline', callback);
  }

  leaveChat(matchId: string) {
    this.joinedRooms.delete(matchId);
    this.socket?.emit('leaveChat', { matchId });
  }

  /** Notify server that all messages in a match have been read */
  markRead(matchId: string) {
    this.socket?.emit('markRead', { matchId });
  }

  /** Listen for read receipts from the other participant */
  onMessagesRead(callback: (data: { matchId: string; readBy: string; readAt: string }) => void) {
    this.handlers['messagesRead'] = callback;
    this.socket?.off('messagesRead');
    this.socket?.on('messagesRead', callback);
  }

  /** Send a voice message as base64 audio content */
  sendAudioMessage(matchId: string, audioBase64: string) {
    this.sendTypedMessage(matchId, audioBase64, 'audio');
  }

  /** @deprecated use emitTyping(matchId) — userId comes from the server JWT */
  sendTyping(matchId: string) {
    this.emitTyping(matchId);
  }

  /** Remove um handler específico (ex.: ao desmontar a tela de conversa). */
  clearMessageHandlers() {
    this.handlers = {};
    if (this.socket) {
      ['newMessage', 'userTyping', 'userOnline', 'userOffline', 'messagesRead', 'messageReaction'].forEach((e) =>
        this.socket?.off(e),
      );
    }
  }

  disconnect() {
    this.appActive = false;
    this.stopTransport();
    this.jwtToken = null;
    this.reconnectAttempts = 0;
    this.handlers = {};
    this.joinedRooms.clear();
    this.setStatus('disconnected');
  }
}

export const socketService = new SocketService();
