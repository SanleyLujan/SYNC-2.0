import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useThemeStore } from '../../store/themeStore';
import { fontSize, spacing } from '../../theme';

/** Full-screen loading uses the same background and accent as the active theme. */
export default function LoadingState({ message }: { message?: string }) {
  const theme = useThemeStore(s => s.theme);
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} accessibilityState={{ busy: true }}>
      <ActivityIndicator size="large" color={theme.primary} accessibilityLabel={message || 'Carregando'} />
      {message && <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  message: { fontSize: fontSize.md, textAlign: 'center' },
});
