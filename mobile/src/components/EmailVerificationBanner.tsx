import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';
import { showToast } from './ui/Toast';
import { colors, spacing, typography, fontSize, borderRadius } from '../theme';

export default function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user);
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified !== false) return null;

  const resend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const result = await authService.resendVerification();
      if (result.emailVerificationSent === false) {
        showToast('Nao conseguimos enviar o email. Confira o Resend/SMTP no Render.', 'info');
      } else {
        showToast('Email de confirmacao reenviado.', 'success');
      }
    } catch {
      showToast('Nao foi possivel reenviar agora.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.banner}>
        <Ionicons name="mail-unread-outline" size={18} color={colors.warning} />
        <Text style={styles.text}>Confirme seu email para proteger a conta.</Text>
        <Pressable onPress={resend} disabled={sending} style={styles.action}>
          <Text style={styles.actionText}>{sending ? 'Enviando' : 'Reenviar'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 9998,
    alignItems: 'center',
  },
  banner: {
    width: '100%',
    maxWidth: 456,
    minHeight: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning + '55',
    backgroundColor: '#211B12',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    lineHeight: 18,
    fontFamily: typography.fontFamily,
  },
  action: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.warningSoft,
  },
  actionText: {
    color: colors.warning,
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontFamily: typography.fontFamily,
  },
});
