// EmptyState com ilustração — imagem dim + ícone + título + CTA
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, fontSize, spacing, borderRadius, typography } from '../../theme';

import { useThemeStore } from '../../store/themeStore';

export default function EmptyState({
  icon = 'search-outline',
  title,
  subtitle,
  image,
  ctaLabel,
  onCtaPress,
}: {
  icon?: keyof typeof import('@expo/vector-icons/build/Ionicons').default.glyphMap;
  title: string;
  subtitle?: string;
  image?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}) {
  const theme = useThemeStore((state) => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {image ? (
        <ImageBackground source={{ uri: image }} style={styles.image} resizeMode="cover">
          <LinearGradient
            colors={['rgba(18,18,22,0.25)', theme.background]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.iconBubble}>
            <Ionicons name={icon as any} size={28} color={theme.primary} />
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.iconLarge}>
          <Ionicons name={icon as any} size={48} color={theme.primary} />
        </View>
      )}

      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

      {ctaLabel && onCtaPress && (
        <Pressable
          onPress={onCtaPress}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient
            colors={theme.gradientPrimary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaInner}
          >
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.primaryText} />
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  image: {
    width: 180,
    height: 180,
    borderRadius: 90,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: theme.primarySoft,
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primarySoft,
    borderWidth: 1,
    borderColor: theme.primary,
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
    maxWidth: 320,
  },
  cta: {
    marginTop: spacing.lg,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
  },
  ctaText: {
    color: theme.primaryText,
    fontSize: 15,
    fontFamily: typography.fontFamily,
    fontWeight: '600',
  },
});
