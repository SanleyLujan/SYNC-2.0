import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { feedApi, FeedComment } from '../../services/feed.service';
import { useAuthStore } from '../../store/authStore';
import { fontSize, spacing, borderRadius } from '../../theme';
import { AppTheme } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarHeight } from '../../navigation/MainTabNavigator';

// Generic params — Comments can be reached from multiple stacks
type CommentsParams = {
  Comments: { postId: string; postAuthorName: string };
};

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<CommentsParams, 'Comments'>;
};

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default function CommentsScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore(state => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { postId, postAuthorName } = route.params;
  const { user } = useAuthStore();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await feedApi.getComments(postId);
      setComments(data || []);
    } catch {
      setError(true);
      showToast('Erro ao carregar comentários', 'error');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!text.trim() || submitting || !user) return;
    setSubmitting(true);
    const optimisticId = `temp-${Date.now()}`;
    const optimistic: FeedComment = {
      id: optimisticId,
      post_id: postId,
      user_id: user!.id,
      user: { id: user!.id, name: user!.name, avatarUrl: user?.avatarUrl },
      text: text.trim(),
      reactions: [],
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    const draft = text.trim();
    setText('');
    try {
      const saved = await feedApi.addComment(postId, draft);
      setComments((prev) => prev.map((c) => (c.id === optimisticId ? saved : c)));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setText(draft);
      showToast(e?.response?.data?.message || 'Erro ao comentar', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReaction = async (comment: FeedComment, emoji: string) => {
    if (comment.id.startsWith('temp-') || reactingTo === `${comment.id}:${emoji}`) return;
    const operation = `${comment.id}:${emoji}`;
    setReactingTo(operation);
    try {
      const result = await feedApi.toggleCommentReaction(postId, comment.id, emoji);
      setComments((prev) => prev.map((item) => {
        if (item.id !== comment.id) return item;
        const others = (item.reactions || []).filter((reaction) => reaction.emoji !== emoji);
        return {
          ...item,
          reactions: result.count > 0 ? [...others, result] : others,
        };
      }));
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Não foi possível reagir', 'error');
    } finally {
      setReactingTo(null);
    }
  };

  const handleDelete = async (comment: FeedComment) => {
    if (comment.user_id !== user?.id) return;
    // confirmAsync funciona no web (Alert.alert ignora os botões lá)
    const ok = await confirmAsync('Apagar comentário?', undefined, {
      confirmText: 'Apagar', destructive: true,
    });
    if (!ok) return;
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    try {
      await feedApi.deleteComment(postId, comment.id);
    } catch {
      setComments((prev) => [...prev, comment].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));
      showToast('Erro ao apagar', 'error');
    }
  };

  const renderItem = ({ item }: { item: FeedComment }) => (
    <View style={styles.commentRow}>
      <Image
        source={
          item.user?.avatarUrl
            ? { uri: item.user.avatarUrl }
            : require('../../assets/images/default-avatar.png')
        }
        style={styles.avatar}
      />
      <View style={styles.bubble}>
        <View style={styles.bubbleHeader}>
          <View style={styles.commenterRow}>
            <Text style={styles.commenterName}>{item.user?.name || 'Usuário'}</Text>
            {item.user?.isVerified && (
              <Ionicons name="checkmark-circle" size={13} color="#2E7BFF" accessibilityLabel="Perfil verificado" />
            )}
          </View>
          <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
        <View style={styles.reactionsRow}>
          {['❤️', '🔥', '💪', '👏', '🎉'].map((emoji) => {
            const reaction = item.reactions?.find((candidate) => candidate.emoji === emoji);
            return (
              <TouchableOpacity
                key={emoji}
                style={[styles.reactionButton, reaction?.mine && styles.reactionButtonSelected]}
                onPress={() => handleReaction(item, emoji)}
                disabled={reactingTo === `${item.id}:${emoji}`}
                accessibilityRole="button"
                accessibilityLabel={`${reaction?.mine ? 'Remover' : 'Adicionar'} reação ${emoji}`}
              >
                <Text style={styles.reactionText}>{emoji}{reaction?.count ? ` ${reaction.count}` : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {item.user_id === user?.id && (
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={{ marginLeft: 4 }}
        >
          <Ionicons name="trash-outline" size={14} color={theme.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: getTabBarHeight(insets.bottom) }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <LinearGradient
        colors={[theme.surface, theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top + 10, 48) }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Comentários</Text>
          <Text style={styles.headerSub}>post de {postAuthorName}</Text>
        </View>
      </LinearGradient>

      {/* Comments list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}
          ListEmptyComponent={
            error ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={48} color={theme.primary + '40'} />
                <Text style={styles.emptyText}>Erro ao carregar comentários</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={load}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={theme.primary + '40'} />
                <Text style={styles.emptyText}>Seja o primeiro a comentar!</Text>
              </View>
            )
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <Image
          source={
            user?.avatarUrl
              ? { uri: user.avatarUrl }
              : require('../../assets/images/default-avatar.png')
          }
          style={styles.inputAvatar}
        />
        <TextInput
          style={styles.input}
          placeholder="Adicionar comentário..."
          accessibilityLabel="Adicionar comentário"
          placeholderTextColor={theme.textSecondary}
          value={text}
          onChangeText={setText}
          maxLength={500}
          multiline
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel="Enviar comentário"
          disabled={submitting || !text.trim()}
          style={[styles.sendBtn, (!text.trim() || submitting) && { opacity: 0.4 }]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="send" size={20} color={theme.primary} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // paddingTop dinâmico via insets no JSX (notch/safe-area)
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.divider,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: theme.border,
    borderWidth: 1,
    borderColor: theme.border,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: theme.textPrimary },
  headerSub: { fontSize: fontSize.xs, color: theme.textSecondary, marginTop: 1 },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.border },
  bubble: {
    flex: 1,
    backgroundColor: theme.surfaceSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commenterRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  commenterName: { fontSize: fontSize.sm, fontWeight: '700', color: theme.textPrimary },
  commentTime: { fontSize: 11, color: theme.textSecondary },
  commentText: { fontSize: fontSize.sm, color: theme.textPrimary, lineHeight: 20 },
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  reactionButton: {
    minHeight: 28,
    paddingHorizontal: 7,
    borderRadius: 14,
    justifyContent: 'center',
    backgroundColor: theme.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  reactionButtonSelected: {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primary,
  },
  reactionText: { color: theme.textPrimary, fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 60, gap: spacing.md },
  emptyText: { color: theme.textSecondary, fontSize: fontSize.md },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.primary,
  },
  retryText: { color: theme.primaryText, fontWeight: '700', fontSize: fontSize.sm },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.divider,
    backgroundColor: theme.surface,
    gap: spacing.sm,
  },
  inputAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.border },
  input: {
    flex: 1,
    backgroundColor: theme.surfaceSecondary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 4,
    color: theme.textPrimary,
    fontSize: fontSize.sm,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sendBtn: { paddingBottom: Platform.OS === 'ios' ? 4 : 8, paddingHorizontal: 4 },
});
