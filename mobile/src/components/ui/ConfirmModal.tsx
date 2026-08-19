import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, spacing, typography } from '../../theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmação cross-platform que NÃO usa Alert nativo
 * (que é instável em web).
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  const accent = destructive ? colors.danger : colors.primary;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconCircle, { borderColor: accent + '40' }]}>
            <Ionicons
              name={destructive ? 'warning-outline' : 'help-circle-outline'}
              size={28}
              color={accent}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.cancelBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelTxt}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: accent },
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.6 },
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              <Text style={styles.confirmTxt}>{loading ? '...' : confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 20px 60px rgba(15,23,42,0.42)' } as any)
      : { elevation: 12, shadowColor: '#0F172A', shadowOpacity: 0.32, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }),
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: typography.fontFamily,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelTxt: { color: colors.textSecondary, fontFamily: typography.fontFamily, fontWeight: '600', fontSize: 14 },
  confirmTxt: { color: colors.primaryText, fontFamily: typography.fontFamily, fontWeight: '600', fontSize: 14 },
});
