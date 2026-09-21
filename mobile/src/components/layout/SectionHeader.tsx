import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logo from '../Logo';
import { useThemeStore } from '../../store/themeStore';
import { borderRadius, fontSize, spacing } from '../../theme';

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
}

/** Shared visual identity for the main sections; compact headers sit over the map. */
export default function SectionHeader({ title, subtitle, actions, children, compact = false }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={theme.mode === 'dark' ? ['#071427', '#04111F'] : ['#FFFFFF', '#F7F8FB']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: theme.border, paddingTop: compact ? 12 : Math.max(insets.top + 12, 28) }]}
    >
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
        <View style={[styles.shard, styles.coral, { backgroundColor: theme.primarySoft }]} />
        <View style={[styles.shard, styles.cyan, { backgroundColor: theme.cyan + '18' }]} />
        <View style={styles.watermark}><Logo size={86} /></View>
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.brand}>
            <Logo size={compact ? 26 : 30} />
            <Text accessibilityRole="header" style={[styles.title, { color: theme.textPrimary }, compact && styles.compactTitle]}>{title}</Text>
          </View>
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
        {subtitle && <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>{subtitle}</Text>}
        <LinearGradient colors={[theme.primary, theme.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.accent, compact && styles.compactAccent]} />
        {children && <View style={styles.footer}>{children}</View>}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: spacing.md, marginTop: spacing.xs, marginBottom: spacing.xs, paddingBottom: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, overflow: 'hidden', flexShrink: 0 },
  content: { paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  title: { fontSize: fontSize.xl, fontWeight: '800', flexShrink: 1 },
  compactTitle: { fontSize: fontSize.lg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  subtitle: { fontSize: fontSize.xs, marginTop: 6 },
  accent: { width: 118, height: 3, borderRadius: 999, marginTop: 12 },
  compactAccent: { width: 80, marginTop: 8 },
  footer: { marginTop: 12 },
  shard: { position: 'absolute', height: 42, borderRadius: 12, transform: [{ rotate: '-18deg' }] },
  coral: { width: 190, right: -28, top: 8 },
  cyan: { width: 145, right: 50, bottom: 8 },
  watermark: { position: 'absolute', right: 22, top: 10, opacity: 0.1, transform: [{ rotate: '-8deg' }] },
});
