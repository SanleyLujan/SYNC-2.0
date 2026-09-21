// ChatRoom — read receipts, voice messages (expo-av), real block/report
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActionSheetIOS,
  Animated,
  ActivityIndicator,
  Pressable,
  Modal,
  Linking,
} from 'react-native';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../../navigation/types';
import { Message, User } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { socketService, SocketStatus } from '../../services/socket.service';
import { chatOutbox } from '../../services/chat-outbox.service';
import { fontSize, spacing, borderRadius } from '../../theme';
import { AppTheme } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { useHaptic } from '../../hooks/useHaptic';
import * as ExpoLocation from 'expo-location';
import { profilePreviewPhoto } from '../../utils/profile-photos';

type Props = {
  navigation: NativeStackNavigationProp<ChatStackParamList, 'ChatRoom'>;
  route: RouteProp<ChatStackParamList, 'ChatRoom'>;
};

export default function ChatRoomScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((state) => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { matchId, userName, userId: otherUserId } = route.params;
  const { user } = useAuthStore();
  const [otherProfile, setOtherProfile] = useState<User | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const currentProfile = otherProfile?.id === otherUserId ? otherProfile : null;
  const displayName = currentProfile?.name || userName;
  const headerPhoto = profilePreviewPhoto(currentProfile, failedPhotos);
  useFocusEffect(useCallback(() => {
    let active = true;
    setOtherProfile(null);
    setFailedPhotos([]);
    if (otherUserId) {
      api.get(`/users/${otherUserId}`).then(({ data }) => {
        if (active && data?.id === otherUserId) setOtherProfile(data);
      }).catch(() => {
        // A missing/private profile or a network failure must not prevent chatting.
      });
    }
    return () => { active = false; };
  }, [otherUserId, user?.id]));
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Voice playback
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<SocketStatus>('connecting');
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const REACTION_EMOJIS = ['🔥', '👏', '😂', '❤️', '💪', '😮'];
  const haptic = useHaptic();
  const soundRef = useRef<Audio.Sound | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingAnim = useRef(new Animated.Value(0)).current;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    loadMessages(1, true);
    setupSocket();
    // Acompanha o status da conexão pra mostrar "Reconectando…" no header
    // e reenviar a fila offline assim que voltar a conectar.
    const unsubStatus = socketService.onStatusChange((s) => {
      setConnStatus(s);
      if (s === 'connected') flushOutbox();
    });
    return () => {
      unsubStatus();
      socketService.leaveChat?.(matchId);
      socketService.clearMessageHandlers?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // Toca/pausa uma mensagem de áudio a partir da URL
  const playAudio = async (messageId: string, url: string) => {
    try {
      // Se já está tocando esta, para
      if (playingId === messageId) {
        await soundRef.current?.stopAsync().catch(() => {});
        await soundRef.current?.unloadAsync().catch(() => {});
        soundRef.current = null;
        setPlayingId(null);
        return;
      }
      // Descarrega qualquer som anterior
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(messageId);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setPlayingId(null);
        }
      });
    } catch {
      showToast('Erro ao reproduzir áudio', 'error');
      setPlayingId(null);
    }
  };

  useEffect(() => {
    Animated.timing(typingAnim, {
      toValue: otherIsTyping ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [otherIsTyping]);

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = async (pageToLoad = 1, reset = false) => {
    if (loadingMore && !reset) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get(`/chat/${matchId}/messages?page=${pageToLoad}&limit=50`);
      const newMessages: Message[] = data.messages || [];
      if (reset) {
        setMessages(newMessages);
      } else {
        setMessages((prev) => [...newMessages, ...prev]);
      }
      setHasMore(newMessages.length === 50);
      setPage(pageToLoad);
      // Mark as read after loading
      api.put(`/chat/${matchId}/read`).catch(() => {});
      socketService.markRead(matchId);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Socket setup ───────────────────────────────────────────────────────────
  const setupSocket = async () => {
    if (!user) return;
    try {
      await socketService.connect();
      socketService.joinChat(matchId);

      socketService.onNewMessage((message: Message) => {
        setMessages((prev) => {
          // Evita duplicar: o servidor faz broadcast pra sala INCLUINDO o
          // remetente, então a própria mensagem volta. Se já existe uma
          // otimista (pending) com o mesmo conteúdo, substitui no lugar.
          if (message.sender_id === user.id) {
            const idx = prev.findIndex(
              (m) => m.pending && m.sender_id === user.id && m.content === message.content,
            );
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...message, pending: false, failed: false };
              return copy;
            }
          }
          // Se o id já está na lista, não adiciona de novo
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        // Mark as read immediately when message from other person arrives
        if (message.sender_id !== user.id) {
          socketService.markRead(matchId);
          api.put(`/chat/${matchId}/read`).catch(() => {});
        }
      });

      socketService.onTyping?.((data: any) => {
        if (data.userId !== user.id) {
          setOtherIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherIsTyping(false), 3000);
        }
      });

      // Read receipts — mark our messages as read
      socketService.onMessagesRead((data) => {
        if (data.matchId === matchId && data.readBy !== user.id) {
          setMessages((prev) =>
            prev.map((m) =>
              m.sender_id === user.id ? { ...m, isRead: true } : m,
            ),
          );
        }
      });

      // Reações em tempo real
      socketService.onMessageReaction?.((data) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m)),
        );
      });
    } catch {
      // HTTP fallback still works
    }
  };

  // ── Reações ──────────────────────────────────────────────────────────────
  const toggleReaction = (messageId: string, emoji: string) => {
    if (!user) return;
    setReactionTarget(null);
    // Atualização otimista local (o servidor confirma via onMessageReaction)
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions: Record<string, string[]> = { ...(m.reactions || {}) };
        const cur = reactions[emoji] || [];
        if (cur.includes(user.id)) {
          const next = cur.filter((u) => u !== user.id);
          if (next.length === 0) delete reactions[emoji];
          else reactions[emoji] = next;
        } else {
          reactions[emoji] = [...cur, user.id];
        }
        return { ...m, reactions: Object.keys(reactions).length ? reactions : null };
      }),
    );
    socketService.reactMessage?.(matchId, messageId, emoji);
  };

  // ── Send text message ──────────────────────────────────────────────────────
  const sendMessage = () => {
    if (!text.trim() || !user) return;
    const content = text.trim();
    const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const optimistic: Message = {
      id: clientId,
      clientId,
      match_id: matchId,
      sender_id: user.id,
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    setIsTyping(false);
    deliver(content, clientId);
  };

  // Entrega de fato: socket se conectado, senão HTTP; se tudo falhar, fila offline.
  const deliver = async (content: string, clientId: string) => {
    if (socketService.getStatus() === 'connected') {
      socketService.sendMessage(matchId, content);
      // o eco via onNewMessage limpa o estado pending
      return;
    }
    // Socket caído → tenta REST
    try {
      const { data } = await api.post('/chat/messages', { matchId, content });
      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === clientId ? { ...(data || m), clientId, pending: false, failed: false } : m,
        ),
      );
      chatOutbox.remove(clientId).catch(() => {});
    } catch {
      // Sem conexão → marca como falha e guarda na fila pra reenviar depois
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)),
      );
      chatOutbox
        .add({ clientId, matchId, content, createdAt: new Date().toISOString() })
        .catch(() => {});
      showToast('Sem conexão — vou enviar quando a internet voltar', 'info');
    }
  };

  const deliverTyped = async (content: string, type: 'image' | 'location') => {
    if (!user) return;
    const clientId = `c_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const optimistic: Message = {
      id: clientId,
      clientId,
      match_id: matchId,
      sender_id: user.id,
      content,
      type,
      isRead: false,
      createdAt: new Date().toISOString(),
      pending: true,
    } as any;
    setMessages((prev) => [...prev, optimistic]);
    if (socketService.getStatus() === 'connected') {
      socketService.sendTypedMessage(matchId, content, type);
      return;
    }
    try {
      const { data } = await api.post('/chat/messages', { matchId, content, type });
      setMessages((prev) =>
        prev.map((m) => (m.clientId === clientId ? { ...(data || m), clientId, pending: false, failed: false } : m)),
      );
    } catch {
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)));
      showToast('Não foi possível enviar agora.', 'error');
    }
  };

  const sendLocation = async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permissão de localização necessária.', 'error');
        return;
      }
      const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      await deliverTyped(JSON.stringify({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        label: 'Minha localização agora',
      }), 'location');
    } catch {
      showToast('Não foi possível obter sua localização.', 'error');
    }
  };

  // Reenvia tudo que ficou pendente na fila (chamado quando a conexão volta)
  const flushOutbox = async () => {
    if (!user) return;
    const items = await chatOutbox.forMatch(matchId).catch(() => []);
    for (const item of items) {
      try {
        const { data } = await api.post('/chat/messages', {
          matchId: item.matchId,
          content: item.content,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.clientId === item.clientId
              ? { ...(data || m), clientId: item.clientId, pending: false, failed: false }
              : m,
          ),
        );
        await chatOutbox.remove(item.clientId);
      } catch {
        break; // ainda offline — para e tenta de novo na próxima reconexão
      }
    }
  };

  // ── Typing ─────────────────────────────────────────────────────────────────
  const handleTextChange = (value: string) => {
    setText(value);
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      socketService.emitTyping(matchId);
    }
    if (value.length === 0) setIsTyping(false);
  };

  // ── Block / Report ─────────────────────────────────────────────────────────
  const confirmBlock = async () => {
    const ok = await confirmAsync('Bloquear usuário?', `Você não verá mais ${userName} no app.`, {
      confirmText: 'Bloquear', destructive: true,
    });
    if (!ok) return;
    try {
      await api.post(`/users/${otherUserId}/block`);
      showToast(`${userName} bloqueado`, 'success');
      navigation.goBack();
    } catch {
      showToast('Erro ao bloquear', 'error');
    }
  };

  const handleReport = async (reason: string) => {
    const ok = await confirmAsync('Confirmar denúncia?', `Motivo: ${reason}`, {
      confirmText: 'Denunciar', destructive: true,
    });
    if (!ok) return;
    try {
      await api.post(`/users/${otherUserId}/report`, { reason });
      showToast('Denúncia enviada. Obrigado!', 'success');
    } catch {
      showToast('Erro ao enviar denúncia', 'error');
    }
  };

  const handleMoreOptions = async () => {
    // iOS: ActionSheet nativo. Demais (Android/web): confirmAsync em sequência
    // (Alert.alert ignora os botões no RN Web).
    if (Platform.OS === 'ios') {
      const options = ['Cancelar', 'Bloquear usuário', 'Spam ou fraude', 'Assédio', 'Conteúdo inadequado'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) confirmBlock();
          if (idx === 2) handleReport('spam');
          if (idx === 3) handleReport('harassment');
          if (idx === 4) handleReport('inappropriate');
        },
      );
      return;
    }
    const block = await confirmAsync('Bloquear usuário?', `Você não verá mais ${userName} no app.`, {
      confirmText: 'Bloquear', destructive: true,
    });
    if (block) { await confirmBlockDirect(); return; }
    const report = await confirmAsync('Denunciar usuário?', `Reportar ${userName} por conteúdo inadequado ou abuso?`, {
      confirmText: 'Denunciar', destructive: true,
    });
    if (report) {
      try {
        await api.post(`/users/${otherUserId}/report`, { reason: 'inappropriate' });
        showToast('Denúncia enviada. Obrigado!', 'success');
      } catch {
        showToast('Erro ao enviar denúncia', 'error');
      }
    }
  };

  // Bloqueio direto (sem reconfirmar — já confirmado no menu)
  const confirmBlockDirect = async () => {
    try {
      await api.post(`/users/${otherUserId}/block`);
      showToast(`${userName} bloqueado`, 'success');
      navigation.goBack();
    } catch {
      showToast('Erro ao bloquear', 'error');
    }
  };

  // ── Render message ─────────────────────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: Message & { type?: string }; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const prevMessage = messages[index - 1];
    const showTime = !prevMessage ||
      new Date(item.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 300000;
    const type = (item as any).type || 'text';
    const isAudio = type === 'audio';
    const isImage = type === 'image';
    const isLocation = type === 'location';
    let locationPayload: any = null;
    if (isLocation) {
      try { locationPayload = JSON.parse(item.content); } catch { locationPayload = null; }
    }

    return (
      <View>
        {showTime && (
          <Text style={styles.timeStamp}>
            {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}
        <Pressable
          onLongPress={() => { haptic.light?.(); setReactionTarget(item.id); }}
          delayLongPress={250}
          style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}
        >
          {isAudio ? (
            <TouchableOpacity
              style={styles.audioBubble}
              onPress={() => playAudio(item.id, item.content)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={playingId === item.id ? 'Pausar áudio' : 'Reproduzir áudio'}
            >
              <Ionicons
                name={playingId === item.id ? 'pause-circle' : 'play-circle'}
                size={26}
                color={isMe ? '#fff' : theme.primary}
              />
              <View style={styles.audioWave}>
                {[...Array(8)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.audioBar,
                      { height: 4 + Math.sin(i * 0.8) * 6 + 6 },
                      { backgroundColor: isMe ? theme.primaryText : theme.primary },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.audioDurText, isMe && { color: 'rgba(255,255,255,0.8)' }]}>
                {playingId === item.id ? 'Tocando…' : 'Áudio'}
              </Text>
            </TouchableOpacity>
          ) : isImage ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.content).catch(() => {})}
              activeOpacity={0.85}
              accessibilityRole="imagebutton"
              accessibilityLabel="Abrir imagem enviada"
            >
              <Image source={{ uri: item.content }} style={styles.chatImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : isLocation && locationPayload ? (
            <TouchableOpacity
              style={styles.locationBubble}
              onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${locationPayload.latitude}&mlon=${locationPayload.longitude}#map=16/${locationPayload.latitude}/${locationPayload.longitude}`).catch(() => {})}
              accessibilityRole="button"
              accessibilityLabel="Abrir localização compartilhada"
            >
              <Ionicons name="location" size={24} color={isMe ? '#fff' : theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.locationTitle, isMe && { color: theme.primaryText }]}>{locationPayload.label || 'Localização'}</Text>
                <Text style={[styles.locationCoords, isMe && { color: 'rgba(255,255,255,0.75)' }]}>
                  {Number(locationPayload.latitude).toFixed(5)}, {Number(locationPayload.longitude).toFixed(5)}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.messageText, isMe && styles.myMessageText]}>
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
              {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isMe && (
              item.failed ? (
                <TouchableOpacity
                  onPress={() => { deliver(item.content, item.clientId || item.id); setMessages((prev) => prev.map((m) => (m.clientId === item.clientId ? { ...m, failed: false, pending: true } : m))); }}
                  accessibilityLabel="Reenviar mensagem"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="alert-circle" size={14} color="#F87171" />
                </TouchableOpacity>
              ) : item.pending ? (
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.5)" />
              ) : (
                <Ionicons
                  name={item.isRead ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.isRead ? theme.success : theme.primaryText}
                />
              )
            )}
          </View>

          {/* Reações */}
          {item.reactions && Object.keys(item.reactions).length > 0 && (
            <View style={styles.reactionsRow}>
              {Object.entries(item.reactions).map(([emoji, users]) => {
                const mine = !!user && users.includes(user.id);
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionChip, mine && styles.reactionChipMine]}
                    onPress={() => toggleReaction(item.id, emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text style={styles.reactionCount}>{users.length}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Pressable>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <LinearGradient
        colors={theme.mode === 'dark'
          ? [theme.surfaceSecondary, theme.surface, theme.background]
          : [theme.surface, theme.surfaceSecondary, theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top + 8, 44) }]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerInfo}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('UserProfile', { userId: otherUserId })}
          disabled={!otherUserId}
          accessibilityRole="button"
          accessibilityLabel={`Ver perfil de ${displayName}`}
          accessibilityHint="Abre o perfil completo e a galeria de fotos"
        >
          <View style={styles.headerAvatar}>
            {headerPhoto ? (
              <Image
                key={headerPhoto}
                source={{ uri: headerPhoto }}
                style={styles.headerAvatarImg}
                resizeMode="cover"
                onError={() => setFailedPhotos(current => [...new Set([...current, headerPhoto])])}
              />
            ) : (
              <LinearGradient colors={theme.gradientPrimary} style={styles.headerAvatarImg}>
                <Text style={styles.headerAvatarInitial}>{displayName?.[0]?.toUpperCase() || '?'}</Text>
              </LinearGradient>
            )}
            <View
              style={[
                styles.headerOnlineDot,
                connStatus !== 'connected' && { backgroundColor: connStatus === 'connecting' ? theme.warning : theme.textSecondary },
              ]}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{displayName}</Text>
            <Text
              style={[
                styles.headerSubtitle,
                connStatus !== 'connected' && { color: connStatus === 'connecting' ? theme.warning : theme.textSecondary },
              ]}
            >
              {connStatus === 'connected'
                ? (otherIsTyping ? 'Digitando…' : 'Online agora')
                : connStatus === 'connecting'
                ? 'Reconectando…'
                : 'Offline'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={handleMoreOptions}
          accessibilityRole="button"
          accessibilityLabel="Mais opções: bloquear ou denunciar"
        >
          <Ionicons name="ellipsis-vertical" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => { if (hasMore && !loadingMore) loadMessages(page + 1, false); }}
              disabled={loadingMore}
            >
              <Text style={styles.loadMoreText}>
                {loadingMore ? 'Carregando...' : 'Carregar mensagens anteriores'}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyChatIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={36} color={theme.primary} />
            </View>
            <Text style={styles.emptyChatText}>Comece a conversa! Diga oi para {userName}</Text>
          </View>
        }
      />

      {/* Typing indicator */}
      <Animated.View style={[
        styles.typingContainer,
        { opacity: typingAnim, transform: [{ translateY: typingAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}>
        <Text style={styles.typingText}>{userName} está digitando...</Text>
        <View style={styles.typingDots}>
          {[1, 0.7, 0.4].map((op, i) => (
            <View key={i} style={[styles.typingDot, { opacity: op }]} />
          ))}
        </View>
      </Animated.View>

      {/* Envio de imagem e áudio suspenso; histórico continua disponível. */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom + 8, spacing.md) }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Mensagem..."
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={1000}
          />
        </View>
        {!text.trim() && (
          <TouchableOpacity style={styles.attachBtn} onPress={sendLocation} accessibilityRole="button" accessibilityLabel="Enviar localização">
            <Ionicons name="location-outline" size={21} color={theme.primary} />
          </TouchableOpacity>
        )}
        {!!text.trim() && (
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} accessibilityRole="button" accessibilityLabel="Enviar mensagem">
            <Ionicons name="send" size={18} color={theme.primaryText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Picker de reações (long-press numa mensagem) */}
      <Modal
        visible={!!reactionTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionTarget(null)}
      >
        <Pressable style={styles.reactionOverlay} onPress={() => setReactionTarget(null)}>
          <View style={styles.reactionPicker}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionPickBtn}
                onPress={() => reactionTarget && toggleReaction(reactionTarget, emoji)}
              >
                <Text style={styles.reactionPickEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  // ── Reações ──────────────────────────────────────────────────────────────
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.surfaceElevated, borderRadius: 12,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: 'transparent',
  },
  reactionChipMine: { backgroundColor: theme.primarySoft, borderColor: theme.primary },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 11, fontWeight: '700', color: theme.textPrimary },
  reactionOverlay: { flex: 1, backgroundColor: theme.overlay, alignItems: 'center', justifyContent: 'center' },
  reactionPicker: {
    flexDirection: 'row', gap: 6, backgroundColor: theme.surfaceElevated,
    borderRadius: 30, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: theme.border,
  },
  reactionPickBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reactionPickEmoji: { fontSize: 26 },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // paddingTop dinâmico via insets no JSX (notch/safe-area)
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerAvatar: { position: 'relative' },
  headerAvatarImg: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 2, borderColor: theme.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarInitial: { color: theme.primaryText, fontSize: 18, fontWeight: '800' },
  headerOnlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: theme.success, borderWidth: 2, borderColor: theme.background,
  },
  headerTitle: { fontSize: fontSize.md, fontWeight: '700', color: theme.textPrimary },
  headerSubtitle: { fontSize: fontSize.xs, color: theme.success, fontWeight: '500' },
  headerAction: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Messages ───────────────────────────────────────────────────────────────
  messageList: { padding: spacing.md, paddingBottom: spacing.sm, flexGrow: 1 },
  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyChatIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.input,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  emptyChatText: { fontSize: fontSize.sm, color: theme.textSecondary, textAlign: 'center' },
  timeStamp: {
    fontSize: 11, color: theme.textSecondary,
    textAlign: 'center', marginVertical: spacing.sm,
  },
  messageBubble: {
    maxWidth: '78%', paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: 20, marginBottom: 4,
  },
  myMessage: {
    alignSelf: 'flex-end', backgroundColor: theme.primary, borderBottomRightRadius: 6,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1, borderColor: theme.border,
    borderBottomLeftRadius: 6,
  },
  messageText: { fontSize: fontSize.md, color: theme.textPrimary, lineHeight: 22 },
  myMessageText: { color: theme.primaryText },
  messageFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, marginTop: 2,
  },
  messageTime: { fontSize: 10, color: theme.textSecondary },
  myMessageTime: { color: 'rgba(255,255,255,0.6)' },

  // ── Audio bubble ───────────────────────────────────────────────────────────
  audioBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  audioWave: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  audioBar: { width: 3, borderRadius: 2 },
  audioDurText: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

  // ── Typing ─────────────────────────────────────────────────────────────────
  typingContainer: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 4, gap: spacing.xs,
  },
  typingText: { fontSize: fontSize.xs, color: theme.textSecondary, fontStyle: 'italic' },
  typingDots: { flexDirection: 'row', gap: 3 },
  typingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.textSecondary },

  // ── Input bar ──────────────────────────────────────────────────────────────
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    backgroundColor: theme.surface,
    borderTopWidth: 1, borderTopColor: theme.divider,
    gap: spacing.xs,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: theme.input,
    borderWidth: 1, borderColor: theme.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md, maxHeight: 100,
  },
  input: {
    fontSize: fontSize.md, color: theme.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8, minHeight: 36,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: theme.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
    shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  attachBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center', marginBottom: 2,
    backgroundColor: theme.primarySoft,
  },
  chatImage: {
    width: 210,
    height: 150,
    borderRadius: 16,
    backgroundColor: theme.divider,
  },
  locationBubble: {
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: '800' },
  locationCoords: { color: theme.textSecondary, fontSize: 11, marginTop: 2 },
  loadMoreBtn: {
    alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.sm,
  },
  loadMoreText: { fontSize: fontSize.xs, color: theme.textSecondary, fontWeight: '500' },
});
