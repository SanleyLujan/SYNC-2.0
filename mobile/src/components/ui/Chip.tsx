import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { borderRadius, fontSize, spacing, typography } from '../../theme';
import { useThemeStore } from '../../store/themeStore';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function Chip({ label, selected, onPress }: ChipProps) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.primarySoft : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={[
        styles.text,
        {
          color: selected ? theme.primary : theme.textSecondary,
          fontWeight: selected ? '600' : '500',
        },
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: fontSize.sm,
    fontFamily: typography.fontFamily,
  },
});
