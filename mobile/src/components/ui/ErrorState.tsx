// Estado de erro padrão — usado quando uma chamada de API falha, no lugar de
// uma tela vazia/branca. Ícone + mensagem + botão "Tentar de novo".
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, fontSize, spacing, borderRadius, typography } from '../../theme';

import { useThemeStore } from '../../store/themeStore';

export default function ErrorState({
  title = 'Algo deu errado',
  subtitle = 'Não conseguimos carregar agora. Verifique sua conexão e tente de novo.',
  onRetry,
  retrying = false,
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  const theme = useThemeStore((state) => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={compact ? 32 : 44} color={theme.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {onRetry && (
        <Pressable
          onPress={onRetry}
          disabled={retrying}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }, retrying && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Tentar de novo"
        >
          <Ionicons name="refresh" size={16} color={theme.primaryText} />
          <Text style={styles.btnText}>{retrying ? 'Tentando…' : 'Tentar de novo'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    width: '100%',
  },
  compact: {
    flex: 0,
    paddingVertical: spacing.xl,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.dangerSoft,
    borderWidth: 1,
    borderColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontFamily: typography.fontFamily,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
    maxWidth: 300,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.lg,
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  btnText: {
    color: theme.primaryText,
    fontSize: 15,
    fontFamily: typography.fontFamily,
    fontWeight: '600',
  },
});
