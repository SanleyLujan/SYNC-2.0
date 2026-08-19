// Tela de configurações — surface sessões, LGPD, conta, notificações, plano
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  Alert,
  Image,
  Linking,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, spacing, borderRadius, ThemeMode } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import api from '../../services/api';
import { showToast } from '../../components/ui/Toast';
import { confirmAsync } from '../../utils/confirm';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import FeedbackModal from '../../components/FeedbackModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Session {
  familyId: string;
  userAgent: string | null;
  ipMasked: string | null;
  createdAt: string;
}

export default function SettingsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [pushOn, setPushOn] = useState(true);
  const [emailOn, setEmailOn] = useState(true);
  const [showChangePwd, setShowChangePwd] = useState(false);

  // Load persisted notification preferences
  useEffect(() => {
    AsyncStorage.multiGet(['notif_push', 'notif_email']).then((pairs) => {
      const pushVal = pairs.find(([k]) => k === 'notif_push')?.[1];
      const emailVal = pairs.find(([k]) => k === 'notif_email')?.[1];
      if (pushVal !== null && pushVal !== undefined) setPushOn(pushVal === 'true');
      if (emailVal !== null && emailVal !== undefined) setEmailOn(emailVal === 'true');
    }).catch(() => {});
  }, []);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'suggestion' | 'rating' | 'support' | null>(null);

  useEffect(() => {
    api.get('/auth/sessions').then((r) => setSessions(r.data || [])).catch(() => {});
    api.get('/subscriptions/me').then((r) => setPlan(r.data)).catch(() => {});
  }, []);

  const handleRevokeSession = async (familyId: string) => {
    try {
      await api.delete(`/auth/sessions/${familyId}`);
      setSessions((s) => s.filter((x) => x.familyId !== familyId));
      showToast('Sessão revogada', 'success');
    } catch {
      showToast('Erro ao revogar sessão', 'error');
    }
  };

  const handleExportData = async () => {
    try {
      const { data } = await api.get('/users/me/export');
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sync-meus-dados-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Dados exportados!', 'success');
      } else {
        await Share.share({
          message: json,
          title: `sync-meus-dados-${Date.now()}.json`,
        });
        showToast('Dados exportados!', 'success');
      }
    } catch {
      showToast('Erro ao exportar', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    const ok = await confirmAsync(
      'Apagar conta?',
      'Sua conta será anonimizada e excluída (LGPD). Irreversível.',
      { confirmText: 'Apagar', destructive: true },
    );
    if (!ok) return;
    try {
      await api.delete('/users/me');
      showToast('Conta excluída', 'success');
      await logout();
    } catch {
      showToast('Erro ao apagar', 'error');
    }
  };

  const handleLogout = async () => {
    const ok = await confirmAsync('Sair', 'Deseja encerrar sua sessão?', {
      confirmText: 'Sair',
      destructive: true,
    });
    if (ok) await logout();
  };

  const handleUpgrade = async () => {
    try {
      const { data } = await api.post('/subscriptions/upgrade', { tier: 'premium' });
      showToast(data.message || 'Upgrade!', 'success');
      const { data: meData } = await api.get('/subscriptions/me');
      setPlan(meData);
    } catch {
      showToast('Erro no upgrade', 'error');
    }
  };

  const Row = ({ icon, label, value, onPress, danger, color = theme.primary, right }: any) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.divider }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? theme.danger : theme.textPrimary }]}>{label}</Text>
      {right || (
        <>
          {value !== undefined && <Text style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={1}>{value}</Text>}
          {onPress && <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />}
        </>
      )}
    </TouchableOpacity>
  );

  const SectionTitle = ({ label }: { label: string }) => (
    <View style={styles.sectionTitleWrap}>
      <View style={[styles.sectionTitleAccent, { backgroundColor: theme.primary }]} />
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );

  const ThemeButton = ({ mode, icon, label }: { mode: ThemeMode; icon: keyof typeof Ionicons.glyphMap; label: string }) => {
    const active = themeMode === mode;
    return (
      <TouchableOpacity
        style={[
          styles.themeButton,
          {
            backgroundColor: active ? theme.primary : theme.surfaceSecondary,
            borderColor: active ? theme.primary : theme.border,
          },
        ]}
        onPress={() => setThemeMode(mode)}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Ionicons name={icon} size={18} color={active ? theme.primaryText : theme.textSecondary} />
        <Text style={[styles.themeButtonText, { color: active ? theme.primaryText : theme.textPrimary }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Premium gradient header */}
      <LinearGradient
        colors={theme.mode === 'dark'
          ? ['#071427', '#040B16', theme.background]
          : ['#FFFFFF', '#F9FAFC', theme.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top + 10, 48) }]}
      >
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={[styles.backBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Configurações</Text>
        <View style={{ width: 36 }} />
      </LinearGradient>

      {/* Profile card */}
      {user && (
        <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.profileCardLeft}>
            <Image
              source={
                user.avatarUrl
                  ? { uri: user.avatarUrl }
                  : require('../../assets/images/default-avatar.png')
              }
              style={styles.profileAvatar}
            />
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.textPrimary }]}>{user.name}</Text>
              <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{user.email}</Text>
              {plan && (
                <View style={styles.planBadge}>
                  <Ionicons
                    name={plan.currentTier === 'premium' ? 'star' : 'star-outline'}
                    size={11}
                    color={plan.currentTier === 'premium' ? '#FCD34D' : theme.textSecondary}
                  />
                  <Text style={[
                    styles.planBadgeText,
                    { color: theme.textSecondary },
                    plan.currentTier === 'premium' && { color: '#FCD34D' },
                  ]}>
                    {plan.plan?.name || 'Free'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.editProfileBtn, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '40' }]}
            onPress={() => navigation?.navigate?.('EditProfile')}
          >
            <Ionicons name="create-outline" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Upgrade card */}
      {plan?.currentTier === 'free' && (
        <TouchableOpacity
          style={styles.upgradeCard}
          onPress={handleUpgrade}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={theme.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upgradeCardInner}
          >
            <View style={styles.upgradeCardLeft}>
              <Ionicons name="star" size={22} color="#fff" />
              <View>
                <Text style={styles.upgradeCardTitle}>Upgrade para Premium</Text>
                <Text style={styles.upgradeCardSub}>R$ 19/mês · Sem anúncios · Ilimitado</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <SectionTitle label="APARÊNCIA" />
      <View style={[styles.themeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.themeCardHeader}>
          <View style={[styles.rowIcon, { backgroundColor: theme.primarySoft }]}>
            <Ionicons name={theme.mode === 'dark' ? 'moon' : 'sunny'} size={18} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.themeCardTitle, { color: theme.textPrimary }]}>Tema do app</Text>
            <Text style={[styles.themeCardSub, { color: theme.textSecondary }]}>
              Escolha o visual que combina melhor com seu uso.
            </Text>
          </View>
        </View>
        <View style={styles.themeButtonRow}>
          <ThemeButton mode="dark" icon="moon-outline" label="Modo escuro" />
          <ThemeButton mode="light" icon="sunny-outline" label="Modo claro" />
        </View>
      </View>

      <SectionTitle label="CONTA" />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row icon="person-outline" label="Nome" value={user?.name} />
        <Row icon="mail-outline" label="Email" value={user?.email} />
        <Row icon="create-outline" label="Editar perfil" onPress={() => navigation?.navigate?.('EditProfile')} />
        <Row icon="lock-closed-outline" label="Alterar senha" onPress={() => setShowChangePwd(true)} />
      </View>

      <SectionTitle label="PLANO" />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row
          icon="star"
          label={plan?.plan?.name || 'Free'}
          value={plan?.plan?.price === 0 ? 'Grátis' : `R$ ${plan?.plan?.price}/mês`}
          color="#FCD34D"
          onPress={() => navigation?.navigate?.('Premium')}
        />
        <Row
          icon="flash"
          label="Desafios"
          onPress={() => navigation?.navigate?.('Challenges')}
          color="#FF6B35"
        />
      </View>

      <SectionTitle label="SEGURANÇA E PRIVACIDADE" />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row
          icon="shield-checkmark-outline"
          label="Central de Segurança"
          value="SOS · verificação · encontro seguro"
          onPress={() => navigation?.navigate?.('SafetyCenter')}
          color="#E11D48"
        />
        <Row
          icon="shield-outline"
          label="Usuários bloqueados"
          onPress={() => navigation?.navigate?.('BlockedUsers')}
          color="#6B7280"
        />
        <Row
          icon="accessibility-outline"
          label="Acessibilidade"
          onPress={() => navigation?.navigate?.('Accessibility')}
          color="#10B981"
        />
      </View>

      <SectionTitle label="NOTIFICAÇÕES" />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row
          icon="notifications"
          label="Push notifications"
          right={
            <Switch
              value={pushOn}
              onValueChange={(val) => {
                setPushOn(val);
                AsyncStorage.setItem('notif_push', String(val)).catch(() => {});
              }}
              trackColor={{ false: theme.surfaceSecondary, true: theme.primary }}
              thumbColor="#fff"
            />
          }
        />
        <Row
          icon="mail"
          label="Notificações por email"
          color="#3B82F6"
          right={
            <Switch
              value={emailOn}
              onValueChange={(val) => {
                setEmailOn(val);
                AsyncStorage.setItem('notif_email', String(val)).catch(() => {});
              }}
              trackColor={{ false: theme.surfaceSecondary, true: theme.blue }}
              thumbColor="#fff"
            />
          }
        />
      </View>

      <SectionTitle label="SESSÕES ATIVAS" />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {sessions.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Apenas esta sessão ativa.</Text>
        ) : (
          sessions.map((s) => (
            <View key={s.familyId} style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(168,139,250,0.20)' }]}>
                <Ionicons name="phone-portrait" size={18} color="#A78BFA" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                  {(s.userAgent || 'Device').split('/')[0]} • {s.ipMasked || '—'}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  Desde {new Date(s.createdAt).toLocaleDateString('pt-BR')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleRevokeSession(s.familyId)}>
                <Text style={styles.revokeText}>Revogar</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <SectionTitle label="PRIVACIDADE & LGPD" />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row icon="download-outline" label="Exportar meus dados" onPress={handleExportData} color="#10B981" />
        <Row icon="document-text-outline" label="Política de privacidade" onPress={() => navigation?.navigate?.('Privacy')} color="#10B981" />
        <Row icon="document-outline" label="Termos de uso" onPress={() => navigation?.navigate?.('Terms')} color="#10B981" />
      </View>

      <SectionTitle label="SUPORTE" />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row icon="help-circle-outline" label="Central de ajuda" onPress={() => navigation?.navigate?.('Help')} />
        <Row icon="bug-outline" label="Reportar problema" onPress={() => setFeedbackType('bug')} color="#F87171" />
        <Row icon="bulb-outline" label="Enviar sugestão" onPress={() => setFeedbackType('suggestion')} color="#FCD34D" />
        <Row icon="chatbubble-outline" label="Falar com suporte" onPress={() => setFeedbackType('support')} color="#3B82F6" />
        <Row icon="star-outline" label="Avaliar o app" onPress={() => setFeedbackType('rating')} color="#FF6B35" />
      </View>

      <SectionTitle label="CONTA" />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row
          icon="log-out-outline"
          label="Sair"
          onPress={handleLogout}
          color="#F87171"
          danger
        />
        <Row icon="trash-outline" label="Apagar minha conta" onPress={handleDeleteAccount} color="#F87171" danger />
      </View>

      <Text style={[styles.version, { color: theme.textSecondary }]}>Sync v1.0.0 · Feito com amor para atletas</Text>

      <ChangePasswordModal visible={showChangePwd} onClose={() => setShowChangePwd(false)} />
      {feedbackType && (
        <FeedbackModal
          visible={!!feedbackType}
          type={feedbackType}
          onClose={() => setFeedbackType(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // paddingTop dinâmico via insets no JSX (notch/safe-area)
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },

  // ── Profile card ──────────────────────────────────────────────────────────
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  profileCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,107,53,0.4)',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: '#fff',
  },
  profileEmail: {
    fontSize: fontSize.xs,
    color: colors.secondaryText,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  planBadgeText: {
    fontSize: fontSize.xs,
    color: colors.secondaryText,
    fontWeight: '600',
  },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,107,53,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Upgrade card ──────────────────────────────────────────────────────────
  upgradeCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  upgradeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  upgradeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  upgradeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  upgradeCardSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // ── Theme selector ───────────────────────────────────────────────────────
  themeCard: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  themeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  themeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  themeCardSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  themeButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.sm,
  },
  themeButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },

  // ── Section header ────────────────────────────────────────────────────────
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitleAccent: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FF6B35',
  },
  sectionTitle: {
    color: colors.dark.secondaryText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Section container ─────────────────────────────────────────────────────
  section: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // ── Row ───────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: spacing.sm,
    minHeight: 56,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  rowValue: { color: colors.dark.secondaryText, fontSize: 13, maxWidth: 180 },
  rowSub: { color: colors.dark.secondaryText, fontSize: 11, marginTop: 2 },
  revokeText: { color: '#F87171', fontSize: 12, fontWeight: '700' },
  emptyText: {
    color: colors.dark.secondaryText,
    padding: spacing.md,
    fontSize: 12,
    fontStyle: 'italic',
  },
  version: {
    textAlign: 'center',
    color: colors.dark.secondaryText,
    fontSize: 11,
    marginTop: spacing.xl,
    opacity: 0.6,
  },
});
