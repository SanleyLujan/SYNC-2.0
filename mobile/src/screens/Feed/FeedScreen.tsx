// Feed de atividades estilo Strava — cards com rota, stats, comentários
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image'; // cache em disco + blurhash-ready
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { feedApi, FeedPost } from '../../services/feed.service';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { confirmAsync } from '../../utils/confirm';
import { isDistanceActivity } from '../../utils/activity-metrics';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { showToast } from '../../components/ui/Toast';
import { useHaptic } from '../../hooks/useHaptic';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import Logo from '../../components/Logo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '../../navigation/MainTabNavigator';

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!isFinite(ts)) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

const SPORT_ICONS: Record<string, string> = {
  running: 'walk', corrida: 'walk',
  cycling: 'bicycle', ciclismo: 'bicycle',
  swimming: 'water', natação: 'water',
  hiking: 'trail-sign', trilha: 'trail-sign',
  gym: 'barbell', academia: 'barbell',
  yoga: 'leaf',
};

const SPORT_LABELS: Record<string, string> = {
  running: 'Corrida',
  corrida: 'Corrida',
  cycling: 'Ciclismo',
  ciclismo: 'Ciclismo',
  swimming: 'Natacao',
  natação: 'Natacao',
  hiking: 'Trilha',
  trilha: 'Trilha',
  gym: 'Academia',
  academia: 'Academia',
  yoga: 'Yoga',
};

interface FeedCardProps {
  post: FeedPost;
  liked: boolean;
  likesCount: number;
  onLike: (id: string, currentlyLiked: boolean) => void;
  onComment: (post: FeedPost) => void;
  onMenu: (post: FeedPost) => void;
}

function FeedCardComponent({ post, liked, likesCount, onLike, onComment, onMenu }: FeedCardProps) {
  const theme = useThemeStore((s) => s.theme);
  const heartScale = useRef(new Animated.Value(1)).current;
  const haptic = useHaptic();
  const reduceMotion = useReduceMotion();

  const handleLike = () => {
    if (!liked) {
      haptic.light(); // feedback tátil ao curtir
      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
          Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 4 }),
        ]).start();
      }
    }
    onLike(post.id, liked);
  };

  // Duplo-toque na foto curte (estilo Instagram).
  const lastTap = useRef(0);
  const onPhotoPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300 && !liked) handleLike();
    lastTap.current = now;
  };

  const sportKey = post.sport?.toLowerCase() || 'running';
  const icon = (SPORT_ICONS[sportKey] || 'walk') as any;
  const sportLabel = SPORT_LABELS[sportKey] || post.sport || 'Atividade';
  const distanceValue = post.distanceKm || 0;
  const distanceKm = distanceValue >= 10 ? distanceValue.toFixed(0) : distanceValue.toFixed(1);
  const primaryResult = isDistanceActivity(sportKey)
    ? `${distanceKm}km`
    : `${Math.max(0, Math.round((post.durationSeconds || 0) / 60))}min`;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Orange gradient accent line */}
      <LinearGradient
        colors={theme.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardAccentLine}
      />

      <View style={styles.cardBody}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.avatarRingWrap}>
            <Image
              source={(() => {
                const u: any = post.user || {};
                const uri = u.avatarUrl || u.profilePhotos?.[0];
                return uri ? { uri } : require('../../assets/images/default-avatar.png');
              })()}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessibilityLabel={`Foto de ${post.user?.name || 'atleta'}`}
            />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.userName, { color: theme.textPrimary }]}>{post.user?.name || 'Atleta'}</Text>
              {post.user?.isVerified && <Ionicons name="checkmark-circle" size={15} color="#2E7BFF" accessibilityLabel="Perfil verificado" />}
            </View>
            <View style={styles.metaRow}>
              <Ionicons name={icon} size={12} color={theme.primary} />
              <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                {sportLabel} • {timeAgo(post.createdAt)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            onPress={() => onMenu(post)}
            accessibilityRole="button"
            accessibilityLabel="Opções do post"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {post.caption && <Text style={[styles.caption, { color: theme.textPrimary }]}>{post.caption}</Text>}

        <View style={[styles.distanceChip, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '45' }]}>
          <Text style={[styles.distanceChipText, { color: theme.primary }]}>{primaryResult}</Text>
        </View>

        {post.photoUrl && (
          <Pressable onPress={onPhotoPress} accessibilityLabel="Foto do treino (toque duas vezes para curtir)">
            <Image
              source={{ uri: post.photoUrl }}
              style={styles.photo}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </Pressable>
        )}

        {/* Actions */}
        <View style={[styles.actions, { borderTopColor: theme.divider }]}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleLike}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={22}
                color={liked ? theme.danger : theme.textSecondary}
              />
            </Animated.View>
            <Text style={[styles.actionLabel, { color: liked ? theme.danger : theme.textSecondary }]}>{likesCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onComment(post)}
            accessibilityRole="button"
            accessibilityLabel={`Comentar post de ${post.user?.name || 'Atleta'}`}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>{post.commentsCount || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            onPress={() => {
              import('react-native').then(({ Share }) => {
                Share.share({ message: `Confira esse treino no Sync! 🔥 ${(post.distanceKm || 0).toFixed(2)}km` });
              });
            }}
          >
            <Ionicons name="share-social-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />
        </View>
      </View>
    </View>
  );
}

// A comparação padrão também atualiza comentários, conteúdo e ações do cartão.
const FeedCard = React.memo(FeedCardComponent);

export default function FeedScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const currentUser = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [countMap, setCountMap] = useState<Record<string, number>>({});

  const PAGE_SIZE = 20;

  const load = useCallback(async (pg = 1, append = false) => {
    if (pg === 1) { setLoading(true); setLoadError(false); }
    else setLoadingMore(true);
    try {
      const data = await feedApi.list(pg);
      const newPosts = data || [];
      if (append) {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...newPosts.filter((p) => !ids.has(p.id))];
        });
        if (newPosts.length > 0) {
          const ids = newPosts.map((p) => p.id);
          const liked = await feedApi.getLikedIds(ids).catch(() => [] as string[]);
          setLikedMap((prev) => {
            const next = { ...prev };
            ids.forEach((id) => { next[id] = liked.includes(id); });
            return next;
          });
        }
      } else {
        setPosts(newPosts);
        const newCounts: Record<string, number> = {};
        newPosts.forEach((p) => { newCounts[p.id] = p.likesCount || 0; });
        setCountMap(newCounts);
        if (newPosts.length > 0) {
          const ids = newPosts.map((p) => p.id);
          const liked = await feedApi.getLikedIds(ids).catch(() => [] as string[]);
          const newLiked: Record<string, boolean> = {};
          ids.forEach((id) => { newLiked[id] = liked.includes(id); });
          setLikedMap(newLiked);
        }
      }
      setHasMore(newPosts.length === PAGE_SIZE);
      setPage(pg);
    } catch {
      setLoadError(true);
      if (!append) setPosts([]);
      // Para o infinite-scroll: sem isso, onEndReached refazia a mesma página
      // em loop infinito quando a rede falha (martelando o servidor).
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  // Recarrega ao focar a aba — assim um treino recém-publicado aparece na hora
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      load(1);
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1, false);
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (!loadingMore && hasMore && !loading) {
      load(page + 1, true);
    }
  };

  const handleLike = async (postId: string, currentlyLiked: boolean) => {
    setLikedMap((prev) => ({ ...prev, [postId]: !currentlyLiked }));
    setCountMap((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] ?? 0) + (currentlyLiked ? -1 : 1)),
    }));
    // Tenta de novo num blip de rede antes de reverter — não perde a curtida.
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        if (currentlyLiked) await feedApi.unlike(postId);
        else await feedApi.like(postId);
        ok = true;
      } catch {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!ok) {
      setLikedMap((prev) => ({ ...prev, [postId]: currentlyLiked }));
      setCountMap((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] ?? 0) + (currentlyLiked ? 1 : -1)),
      }));
      showToast('Erro ao curtir', 'error');
    }
  };

  const handleComment = (post: FeedPost) => {
    navigation.navigate('Comments', { postId: post.id, postAuthorName: post.user?.name || 'Atleta' });
  };

  const handleMenu = async (post: FeedPost) => {
    const isOwn = currentUser?.id && post.user_id === currentUser.id;
    if (isOwn) {
      const ok = await confirmAsync('Apagar publicação?', 'Esta ação não pode ser desfeita.', {
        confirmText: 'Apagar', destructive: true,
      });
      if (!ok) return;
      try {
        await feedApi.remove(post.id);
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        showToast('Publicação removida', 'success');
      } catch {
        showToast('Erro ao remover', 'error');
      }
    } else {
      const ok = await confirmAsync('Denunciar publicação?', `Reportar o post de ${post.user?.name || 'usuário'}?`, {
        confirmText: 'Denunciar', destructive: true,
      });
       if (ok) {
         try {
           await feedApi.report(post.id, 'inappropriate');
           showToast('Denúncia enviada para análise.', 'success');
         } catch (error: any) {
           showToast(error?.response?.data?.message || 'Não foi possível enviar a denúncia.', 'error');
         }
       }
    }
  };

  const ListFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>Carregando mais...</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.mode === 'dark'
          ? ['rgba(7,20,39,0.98)', 'rgba(4,17,31,0.96)']
          : ['#FFFFFF', '#F7F8FB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top + 12, 56), borderColor: theme.border }]}
      >
        <View style={[styles.headerGrid, { borderColor: theme.divider }]} />
        <View style={[styles.headerShard, styles.headerShardOne, { backgroundColor: theme.primarySoft }]} />
        <View style={[styles.headerShard, styles.headerShardTwo, { backgroundColor: theme.cyan + '22' }]} />
        <View style={[styles.headerWatermark, { borderColor: theme.primary + '22' }]}>
          <Logo size={92} />
        </View>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.headerIconButton, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              onPress={() => showToast('Menu em breve')}
              accessibilityRole="button"
              accessibilityLabel="Abrir menu"
            >
              <Ionicons name="menu-outline" size={22} color={theme.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerBrand}>
              <Logo size={30} variant="filled" />
              <Text style={[styles.title, { color: theme.textPrimary }]}>Feed</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              onPress={() => navigation.navigate('UserSearch')}
            >
              <Ionicons name="search-outline" size={22} color={theme.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerAccentWrap}>
          <LinearGradient
            colors={[theme.primary, theme.cyan]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerAccent}
          />
        </View>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <FeedCard
              post={item}
              liked={likedMap[item.id] ?? false}
              likesCount={countMap[item.id] ?? item.likesCount ?? 0}
              onLike={handleLike}
              onComment={handleComment}
              onMenu={handleMenu}
            />
          )}
          extraData={{ likedMap, countMap }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={<ListFooter />}
          contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.md }}
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={9}
          ListEmptyComponent={
            loadError ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={64} color={theme.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Erro ao carregar</Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Verifique sua conexão e tente de novo.</Text>
                <TouchableOpacity
                  style={[styles.feedRetryBtn, { backgroundColor: theme.primary }]}
                  onPress={() => load(1)}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                >
                  <Ionicons name="refresh" size={16} color={theme.primaryText} />
                  <Text style={[styles.feedRetryText, { color: theme.primaryText }]}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIconWrap, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}>
                  <Ionicons name="newspaper-outline" size={40} color={theme.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Feed vazio</Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Complete um treino e poste aqui para ver seu feed.
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' },

  // ── Hero header ──────────────────────────────────────────────────────────
  header: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    zIndex: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerGrid: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -24,
    height: 92,
    borderTopWidth: 1,
    opacity: 0.65,
  },
  headerShard: {
    position: 'absolute',
    height: 42,
    borderRadius: 12,
    transform: [{ rotate: '-18deg' }],
  },
  headerShardOne: {
    width: 190,
    right: -28,
    top: 22,
  },
  headerShardTwo: {
    width: 145,
    right: 78,
    bottom: 12,
  },
  headerWatermark: {
    position: 'absolute',
    right: 22,
    top: 24,
    width: 116,
    height: 116,
    borderRadius: 24,
    borderWidth: 1,
    opacity: 0.16,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  headerRight: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  headerAccentWrap: {
    paddingLeft: spacing.lg + 48,
    paddingRight: spacing.lg,
    marginTop: spacing.md,
    zIndex: 2,
  },
  headerAccent: {
    height: 3,
    width: 118,
    borderRadius: 999,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: '#fff',
  },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  cardAccentLine: {
    height: 2.5,
    width: '100%',
  },
  cardBody: {
    padding: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatarRingWrap: {
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,107,53,0.4)',
    padding: 1,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  userName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { color: colors.dark.secondaryText, fontSize: 12 },
  caption: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  distanceChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginBottom: spacing.md,
  },
  distanceChipText: {
    fontSize: fontSize.xs,
    fontWeight: '800',
  },

  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, minWidth: 44 },
  actionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },

  // ── Empty ─────────────────────────────────────────────────────────────────
  empty: { alignItems: 'center', marginTop: 100, paddingHorizontal: spacing.xl },
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  emptyText: {
    color: colors.dark.secondaryText,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 22,
  },
  feedRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FF6B35',
  },
  feedRetryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.lg,
  },
  footerText: { color: colors.dark.secondaryText, fontSize: 13 },
});
