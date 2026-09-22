import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  RefreshControl,
  Animated,
} from 'react-native';
import { Image } from 'expo-image'; // cache em disco para avatares do chat
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ChatStackParamList } from '../../navigation/types';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { useThemeStore } from '../../store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../services/api';
import { normalizeConversations, ConversationListItem } from '../../utils/social-lists';
import SectionHeader from '../../components/layout/SectionHeader';
import { SkeletonList } from '../../components/ui/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '../../navigation/MainTabNavigator';

type Props = {
  navigation: NativeStackNavigationProp<ChatStackParamList, 'ConversationList'>;
};

export default function ConversationListScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadConversations();
  }, []);

  // Recarrega ao focar a aba — assim um match novo (ou nova mensagem) aparece
  // sempre que você abre o Chat, sem precisar puxar pra atualizar.
  const firstFocus = React.useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      loadConversations();
    }, []),
  );

  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: showSearch ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [showSearch]);

  const loadConversations = async () => {
    setError(false);
    try {
      const { data } = await api.get('/chat/conversations');
      setConversations(normalizeConversations(data));
    } catch (err) {
      setError(true);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, []);

  const formatTime = (date: string) => {
    const d = new Date(date);
    if (!Number.isFinite(d.getTime())) return '';
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const filteredConversations = searchQuery
    ? conversations.filter((c) =>
        (c.user?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.lastMessage?.content ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const renderItem = ({ item }: { item: ConversationListItem }) => (
    <TouchableOpacity
      style={[styles.item, item.unreadCount > 0 && { backgroundColor: theme.primarySoft }]}
      onPress={() =>
        navigation.navigate('ChatRoom', {
          matchId: item.matchId,
          userName: item.user.name,
          userId: item.user.id,
        })
      }
      activeOpacity={0.7}
    >
      {/* Orange accent strip for unread */}
      {item.unreadCount > 0 && <View style={[styles.unreadStrip, { backgroundColor: theme.primary }]} />}

      {/* Avatar with gradient ring for unread */}
      <View style={styles.avatarWrap}>
        {item.unreadCount > 0 ? (
          <LinearGradient
            colors={theme.gradientPrimary}
            style={[styles.avatarRing, { shadowColor: theme.primary }]}
          >
            <Image
              source={
                item.user.avatarUrl
                  ? { uri: item.user.avatarUrl }
                  : require('../../assets/images/default-avatar.png')
              }
              style={[styles.avatarInner, { borderColor: theme.background }]}
            />
          </LinearGradient>
        ) : (
          <Image
            source={
              item.user.avatarUrl
                ? { uri: item.user.avatarUrl }
                : require('../../assets/images/default-avatar.png')
            }
            style={styles.avatar}
          />
        )}
      </View>

      <View style={[styles.info, { borderBottomColor: theme.divider }]}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.name,
              item.unreadCount > 0 && styles.nameBold,
              { color: item.unreadCount > 0 ? theme.textPrimary : theme.textSecondary },
            ]}
            numberOfLines={1}
          >
            {item.user.name}
          </Text>
          {item.lastMessage && (
            <Text style={[styles.time, item.unreadCount > 0 && styles.timeActive, { color: item.unreadCount > 0 ? theme.primary : theme.textSecondary }]}>
              {formatTime(item.lastMessage.createdAt)}
            </Text>
          )}
        </View>
        <View style={styles.messageRow}>
          <Text
            style={[
              styles.lastMessage,
              item.unreadCount > 0 && styles.lastMessageUnread,
              { color: item.unreadCount > 0 ? theme.textPrimary : theme.textSecondary },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage?.content || 'Diga oi! 👋'}
          </Text>
          {item.unreadCount > 0 && (
            <LinearGradient
              colors={theme.gradientPrimary}
            style={[styles.badge, { shadowColor: theme.primary }]}
            >
              <Text style={styles.badgeText}>
                {item.unreadCount > 9 ? '9+' : item.unreadCount}
              </Text>
            </LinearGradient>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const header = (
    <SectionHeader
      title="Mensagens"
      subtitle={totalUnread > 0
        ? `${totalUnread} ${totalUnread === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`
        : 'Converse e combine o próximo treino.'}
      actions={!loading && !error && (
        <TouchableOpacity
          style={[
            styles.searchBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
            showSearch && { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel={showSearch ? 'Fechar busca de conversas' : 'Buscar conversas'}
          accessibilityState={{ expanded: showSearch }}
          onPress={() => {
            setShowSearch(!showSearch);
            if (showSearch) setSearchQuery('');
          }}
        >
          {showSearch ? (
            <Ionicons name="close" size={20} color={theme.primaryText} />
          ) : (
            <Ionicons name="search-outline" size={20} color={theme.textPrimary} />
          )}
        </TouchableOpacity>
      )}
    />
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {header}
        <SkeletonList count={7} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {header}
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}>
            <Ionicons name="wifi-outline" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Erro ao carregar</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Verifique sua conexão e tente novamente.</Text>
          <TouchableOpacity
            style={[styles.ctaBtn, { shadowColor: theme.primary }]}
            onPress={() => { setLoading(true); loadConversations(); }}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={theme.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaBtnInner}
            >
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.ctaBtnText}>Tentar novamente</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {header}

      {/* Animated search bar */}
      <Animated.View style={[
        styles.searchContainer,
        {
          backgroundColor: theme.background,
          maxHeight: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }),
          opacity: searchAnim,
        },
      ]}>
        <View style={[styles.searchInputWrap, { backgroundColor: theme.input, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            accessibilityLabel="Buscar conversas por nome"
            placeholder="Buscar conversas..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={showSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {filteredConversations.length === 0 ? (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}>
            <Ionicons name="chatbubbles-outline" size={40} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            {searchQuery ? 'Nenhum resultado' : 'Nenhuma conversa'}
          </Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {searchQuery
              ? `Nenhuma conversa encontrada para "${searchQuery}"`
              : 'Seus matches aparecerao aqui.\nComece a dar likes no Descobrir!'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              style={[styles.ctaBtn, { shadowColor: theme.primary }]}
              onPress={() => navigation.getParent()?.navigate('HomeTab')}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={theme.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaBtnInner}
              >
                <Ionicons name="people" size={18} color="#fff" />
                <Text style={styles.ctaBtnText}>Descobrir pessoas</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.matchId}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 16 }}
          removeClippedSubviews={true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: '#0A0A0F',
  },

  // ── Header ──────────────────────────────────────────────────────────────
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // ── Search bar ───────────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
    backgroundColor: '#0A0A0F',
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    height: 44,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: '#fff',
    paddingVertical: 0,
  },

  // ── Conversation item ────────────────────────────────────────────────────
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    position: 'relative',
  },
  itemUnread: {
    backgroundColor: 'rgba(255,107,53,0.04)',
  },
  unreadStrip: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#FF6B35',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2,
    borderColor: '#0A0A0F',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    paddingBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  nameBold: {
    fontWeight: '700',
    color: '#fff',
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.secondaryText,
  },
  timeActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessage: {
    fontSize: fontSize.sm,
    color: colors.secondaryText,
    flex: 1,
  },
  lastMessageUnread: {
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
    paddingHorizontal: 6,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },

  // ── Empty / error states ─────────────────────────────────────────────────
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,107,53,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  ctaBtn: {
    marginTop: spacing.xl,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },
  ctaBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  ctaBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
});
