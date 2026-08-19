import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, borderRadius } from '../../theme';

interface ProgressBarProps {
  current: number;
  total: number;
  tone?: 'primary' | 'success' | 'purple';
}

export default function ProgressBar({ current, total, tone = 'success' }: ProgressBarProps) {
  const progress = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  const fillColor =
    tone === 'primary' ? colors.primary : tone === 'purple' ? colors.purple : colors.success;

  return (
    <View style={styles.container}>
      <View style={[styles.fill, { width: `${progress}%`, backgroundColor: fillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 4,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
});
