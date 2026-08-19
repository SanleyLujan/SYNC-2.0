// Badge de streak (dias consecutivos com atividade) com animação de fogo.
// Cor escala conforme marco: 7 / 30 / 100 dias.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, borderRadius } from '../theme';
import { useThemeStore } from '../store/themeStore';

type Tier = { color1: string; color2: string; label: string };

function tierFor(days: number): Tier {
  if (days >= 100) return { color1: '#FF1744', color2: '#7C0000', label: 'LENDÁRIO' };
  if (days >= 30) return { color1: '#FF6B35', color2: '#FF1744', label: 'EM CHAMAS' };
  if (days >= 7) return { color1: '#FFB13B', color2: '#FF6B35', label: 'ACESO' };
  if (days >= 1) return { color1: '#FF6B35', color2: '#FF8A5C', label: 'COMEÇANDO' };
  return { color1: '#3A3A50', color2: '#1E1E32', label: 'INATIVO' };
}

export default function StreakBadge({
  days,
  bestDays,
  compact = false,
}: {
  days: number;
  bestDays?: number;
  compact?: boolean;
}) {
  const theme = useThemeStore((s) => s.theme);
  const tier = tierFor(days);
  const pulse = useRef(new Animated.Value(1)).current;
  const isActive = days > 0;
  const iconColor = isActive ? theme.warning : theme.primary;
  const statusColor = isActive ? theme.warning : theme.textSecondary;

  useEffect(() => {
    if (days >= 1) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.12,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [days]);

  if (compact) {
    return (
      <View style={[styles.compact, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '30' }]}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Ionicons name="flame" size={14} color={iconColor} />
        </Animated.View>
        <Text style={[styles.compactText, { color: iconColor }]}>{days}</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={theme.mode === 'dark'
        ? [theme.surfaceElevated, theme.surface]
        : [theme.surface, theme.surfaceSecondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderColor: theme.border, shadowColor: theme.primary }]}
    >
      <View style={[styles.accentRail, { backgroundColor: isActive ? theme.warning : theme.primary }]} />
      <Animated.View style={[styles.iconWrap, { backgroundColor: isActive ? theme.warningSoft : theme.primarySoft, transform: [{ scale: pulse }] }]}>
        <Ionicons name="flame" size={32} color={iconColor} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.daysNumber, { color: theme.textPrimary }]}>{days}</Text>
        <Text style={[styles.daysLabel, { color: theme.textPrimary }]}>
          {days === 1 ? 'dia' : 'dias'} consecutivos
        </Text>
        <View style={styles.tierRow}>
          <Text style={[styles.tierLabel, { color: statusColor, backgroundColor: isActive ? theme.warningSoft : theme.surfaceSecondary }]}>
            {tier.label}
          </Text>
          {bestDays != null && bestDays > days && (
            <Text style={[styles.best, { color: theme.textSecondary }]}>Recorde: {bestDays}</Text>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
    overflow: 'hidden',
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysNumber: {
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  daysLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  tierLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  best: {
    fontSize: 10,
    fontWeight: '600',
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactText: {
    fontWeight: '800',
    fontSize: 13,
  },
});
