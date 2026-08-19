import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../../services/auth.service';
import { colors, spacing, borderRadius, typography, fontSize } from '../../theme';

type Props = {
  token: string;
};

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailScreen({ token }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Confirmando seu email...');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await authService.verifyEmail(token);
        const stored = await authService.getStoredUser();
        if (stored?.user && stored.token) {
          await authService.saveAuth({
            user: { ...stored.user, emailVerified: true },
            accessToken: stored.token,
          });
        }
        if (!alive) return;
        setStatus('success');
        setMessage('Email confirmado com sucesso.');
      } catch (error: any) {
        if (!alive) return;
        const msg = error.response?.data?.message;
        setStatus('error');
        setMessage(Array.isArray(msg) ? msg.join(' ') : msg || 'Link invalido ou expirado.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const goHome = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const icon = status === 'success' ? 'checkmark-circle' : status === 'error' ? 'alert-circle' : 'mail-outline';
  const iconColor = status === 'success' ? colors.success : status === 'error' ? colors.error : colors.primary;

  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <Ionicons name={icon as any} size={48} color={iconColor} />
        <Text style={styles.title}>
          {status === 'success' ? 'Email confirmado' : status === 'error' ? 'Nao foi possivel confirmar' : 'Confirmando email'}
        </Text>
        <Text style={styles.subtitle}>{message}</Text>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <Pressable onPress={goHome} style={styles.button}>
            <LinearGradient colors={colors.gradientPrimary} style={styles.buttonInner}>
              <Text style={styles.buttonText}>Voltar para o Sync</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontFamily: typography.fontFamily,
  },
  loader: { marginTop: spacing.lg },
  button: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  buttonInner: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: fontSize.md,
    fontWeight: '700',
    fontFamily: typography.fontFamily,
  },
});
