import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { Image } from 'expo-image'; // cache em disco para a foto do perfil
import { CommonActions, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { User, SPORTS, OBJECTIVES, AVAILABILITY, SportLevel } from '../../types';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';
import { useThemeStore } from '../../store/themeStore';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any, any>;
};

const levelLabels: Record<string, string> = {
  [SportLevel.BEGINNER]: 'Iniciante',
  [SportLevel.INTERMEDIATE]: 'Intermediário',
  [SportLevel.ADVANCED]: 'Avançado',
};

const levelColors: Record<string, string> = {
  [SportLevel.BEGINNER]: '#4ADE80',
  [SportLevel.INTERMEDIATE]: '#FB923C',
  [SportLevel.ADVANCED]: '#F87171',
};

export default function UserProfileScreen({ navigation, route }: Props) {
  const { userId } = route.params as { userId: string };
  const theme = useThemeStore((s) => s.theme);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const toggleFollow = async () => {
    if (followBusy || following == null) return;
    setFollowBusy(true);
    try {
      if (following) await api.delete('/follows/' + userId);
      else await api.post('/follows/' + userId);
      setFollowing(!following);
      showToast(following ? 'Você deixou de seguir este perfil.' : 'Seguindo. Isso não cria um match nem libera conteúdo privado.', 'success');
    } catch { showToast('Não foi possível atualizar. Tente novamente.', 'error'); }
    finally { setFollowBusy(false); }
  };

  useEffect(() => { loadUser(); }, [userId]);

  const loadUser = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get(`/users/${userId}`);
      setUser(data);
      setFollowing(null);
      const status = await api.get('/follows/' + userId + '/status');
      setFollowing(!!status.data.isFollowing);
    } catch {
      setError(true);
      showToast('Erro ao carregar perfil', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Menu de opções via confirmAsync (Alert.alert não mostra botões no RN Web).
  // Sequência: bloquear? → senão denunciar?
  const handleMoreOptions = async () => {
    const block = await confirmAsync(
      'Bloquear usuário?',
      `Você não verá mais ${user?.name || 'este usuário'} no app e eles não poderão te contatar.`,
      { confirmText: 'Bloquear', destructive: true },
    );
    if (block) { await doBlock(); return; }
    const report = await confirmAsync(
      'Denunciar usuário?',
      `Reportar ${user?.name || 'este usuário'} por conteúdo inadequado ou comportamento abusivo?`,
      { confirmText: 'Denunciar', destructive: true },
    );
    if (report) await submitReport('inappropriate');
  };

  const doBlock = async () => {
    setBlocking(true);
    try {
      await api.post(`/users/${userId}/block`);
      showToast('Usuário bloqueado', 'success');
      navigation.goBack();
    } catch {
      showToast('Erro ao bloquear usuário', 'error');
    } finally {
      setBlocking(false);
    }
  };

  const submitReport = async (reason: string) => {
    try {
      await api.post(`/users/${userId}/report`, { reason });
      showToast('Denúncia enviada. Obrigado!', 'success');
    } catch {
      showToast('Erro ao enviar denúncia', 'error');
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Ionicons
          name={error ? 'cloud-offline-outline' : 'person-outline'}
          size={48}
          color={theme.textMuted}
        />
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          {error ? 'Não foi possível carregar o perfil.' : 'Perfil não encontrado'}
        </Text>
        {error && (
          <TouchableOpacity
            style={[styles.backBtnFallback, { backgroundColor: theme.primary }]}
            onPress={loadUser}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <Text style={styles.backBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.backBtnFallback,
            { backgroundColor: theme.primary },
            error && { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
          ]}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={[styles.backBtnText, error && { color: theme.textPrimary }]}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const levelColor = levelColors[user.level] || theme.primary;
  const handleChallenge = () => {
    const parent = navigation.getParent?.();
    if (parent) {
      const profileRoute = parent.getState().routes.find((item: { name: string }) => item.name === 'ProfileTab');
      if (profileRoute?.state?.key) {
        parent.dispatch({
          ...CommonActions.reset({ index: 1, routes: [{ name: 'MyProfile' }, { name: 'Challenges' }] }),
          target: profileRoute.state.key,
        });
      }
      parent.navigate('ProfileTab', { screen: 'Challenges', initial: false });
      return;
    }
    navigation.navigate('Challenges');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* Hero photo */}
        <View style={styles.heroWrap}>
          <Image
            source={
              user.avatarUrl
                ? { uri: user.avatarUrl }
                : require('../../assets/images/default-avatar.png')
            }
            style={styles.heroImage}
            accessibilityLabel={`Foto de ${user.name}`}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
          {/* Back button */}
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.mode === 'dark' ? 'rgba(3,9,20,0.68)' : 'rgba(255,255,255,0.78)', borderColor: theme.border }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.mode === 'dark' ? colors.white : theme.textPrimary} />
          </TouchableOpacity>

          {/* More / block-report */}
          <TouchableOpacity
            style={[styles.moreBtn, { backgroundColor: theme.mode === 'dark' ? 'rgba(3,9,20,0.68)' : 'rgba(255,255,255,0.78)', borderColor: theme.border }]}
            onPress={handleMoreOptions}
            disabled={blocking}
          >
            {blocking
              ? <ActivityIndicator size="small" color={theme.mode === 'dark' ? colors.white : theme.textPrimary} />
              : <Ionicons name="ellipsis-vertical" size={20} color={theme.mode === 'dark' ? colors.white : theme.textPrimary} />
            }
          </TouchableOpacity>

        </View>

        {/* Content */}
        <View style={[styles.content, { backgroundColor: theme.background }]}>
          {/* Nome fora da foto para manter a imagem sem filtros. */}
          <View style={styles.heroNameWrap}>
            <View style={styles.heroNameRow}>
              <Text style={[styles.heroName, { color: theme.textPrimary }]} numberOfLines={1}>{user.name}</Text>
              {user.isVerified && <Ionicons name="checkmark-circle" size={20} color="#2E7BFF" accessibilityLabel="Perfil verificado" />}
            </View>
            {user.city && (
              <View style={styles.heroLocation}>
                <Ionicons name="location-outline" size={13} color={theme.textSecondary} />
                <Text style={[styles.heroCity, { color: theme.textSecondary }]} numberOfLines={1}>{user.city}</Text>
              </View>
            )}
          </View>
          {/* Badges row */}
          <View style={styles.badgesRow}>
            {user.level && (
              <View style={[styles.levelBadge, { borderColor: levelColor + '50', backgroundColor: levelColor + '12' }]}>
                <Ionicons name="trophy-outline" size={14} color={levelColor} />
                <Text style={[styles.levelText, { color: levelColor }]}>
                  {levelLabels[user.level] || user.level}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={[styles.challengeBtn, { backgroundColor: theme.primarySoft, padding: 14 }]}
            onPress={toggleFollow} disabled={followBusy || following == null} accessibilityRole="button">
            <Text style={{ color: theme.primary, textAlign: 'center', fontWeight: '700' }}>{followBusy ? 'Salvando…' : following ? 'Seguindo · deixar de seguir' : 'Seguir perfil'}</Text>
          </TouchableOpacity>
          <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 12 }}>Seguir acompanha o perfil nos rankings de seguidos. Match é uma conexão por interesse mútuo.</Text>
          {/* Challenge button */}
          <TouchableOpacity
            style={styles.challengeBtn}
            onPress={handleChallenge}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={theme.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.challengeBtnGradient}
            >
              <Ionicons name="flash" size={16} color="#fff" />
              <Text style={styles.challengeBtnText}>Desafiar {user.name.split(' ')[0]}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Bio */}
          {user.bio && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Sobre</Text>
              <Text style={[styles.bio, { color: theme.textPrimary }]}>{user.bio}</Text>
            </View>
          )}

          {/* Sports */}
          {user.sports && user.sports.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Esportes</Text>
              <View style={styles.tags}>
                {user.sports.map((s) => {
                  const sport = SPORTS.find((sp) => sp.id === s);
                  return (
                    <View key={s} style={[styles.tag, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}>
                      <Text style={[styles.tagText, { color: theme.primary }]}>{sport?.label || s}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Availability */}
          {user.availability && user.availability.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Disponibilidade</Text>
              <View style={styles.tags}>
                {user.availability.map((a) => {
                  const item = AVAILABILITY.find((av) => av.id === a);
                  return (
                    <View key={a} style={[styles.tag, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}>
                      <Text style={[styles.tagText, { color: theme.primary }]}>{item?.label || a}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Objectives */}
          {user.objectives && user.objectives.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Objetivos</Text>
              <View style={styles.tags}>
                {user.objectives.map((o) => {
                  const obj = OBJECTIVES.find((ob) => ob.id === o);
                  return (
                    <View key={o} style={[styles.tag, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}>
                      <Text style={[styles.tagText, { color: theme.primary }]}>{obj?.label || o}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {user.hobbies && user.hobbies.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Hobbies</Text>
              <View style={styles.tags}>
                {user.hobbies.map((h) => (
                  <View key={h} style={[styles.tag, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}>
                    <Text style={[styles.tagText, { color: theme.primary }]}>{h}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Bottom spacer */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md,
    backgroundColor: '#0A0A0F',
  },
  errorText: { color: colors.dark.secondaryText, fontSize: fontSize.md },
  backBtnFallback: {
    paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
    backgroundColor: colors.primary, borderRadius: borderRadius.md, marginTop: spacing.md,
  },
  backBtnText: { color: colors.white, fontWeight: '700' },
  heroWrap: { height: 380, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    left: spacing.lg,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(10,10,15,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  moreBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    right: spacing.lg,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(10,10,15,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroNameWrap: {
    marginBottom: spacing.lg,
  },
  heroName: {
    fontSize: 28, fontWeight: '800', color: colors.white,
  },
  heroLocation: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
  },
  heroCity: {
    fontSize: fontSize.sm, color: 'rgba(255,255,255,0.85)',
  },
  content: { padding: spacing.lg },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  levelText: { fontSize: fontSize.sm, fontWeight: '700' },
  challengeBtn: { borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.lg },
  challengeBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13,
  },
  challengeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: fontSize.xs, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: spacing.sm,
  },
  bio: { fontSize: fontSize.md, color: 'rgba(255,255,255,0.80)', lineHeight: 24 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: 'rgba(255,107,53,0.14)',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,107,53,0.30)',
  },
  tagText: { fontSize: fontSize.sm, color: '#FF9A5C', fontWeight: '600' },
});
