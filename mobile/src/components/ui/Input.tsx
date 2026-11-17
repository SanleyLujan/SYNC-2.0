import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius, fontSize, spacing, typography } from '../../theme';
import { useThemeStore } from '../../store/themeStore';
import { setWebStyleRules } from '../../utils/web-styles';

// WEB: remove o outline de foco do navegador (a "borda branca" extra) e o
// fundo branco/amarelo do autofill — eles ignoram o CSS do React Native.
// Injetado uma única vez no <head>.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const STYLE_ID = 'sync-input-web-fix';
  if (!document.getElementById(STYLE_ID)) {
    setWebStyleRules(STYLE_ID, [
      'input, textarea, select { outline: none !important; box-shadow: none; }',
      'input:focus, textarea:focus { outline: none !important; }',
      `input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-text-fill-color: ${colors.textPrimary} !important;
        caret-color: ${colors.textPrimary} !important;
        -webkit-box-shadow: 0 0 0px 1000px ${colors.input} inset !important;
        box-shadow: 0 0 0px 1000px ${colors.input} inset !important;
        transition: background-color 9999s ease-in-out 0s;
      }
      `,
    ]);
  }
}

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  isPassword?: boolean;
}

export default function Input({
  label,
  error,
  isPassword,
  ...props
}: InputProps) {
  const theme = useThemeStore((s) => s.theme);
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: isFocused ? theme.surfaceElevated : theme.input,
            borderColor: isFocused ? theme.inputFocus : theme.border,
          },
          error && { borderColor: theme.danger },
        ]}
      >
        <TextInput
          style={[styles.input, { color: theme.textPrimary }, Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : null]}
          placeholderTextColor={theme.placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: fontSize.md,
    fontFamily: typography.fontFamily,
  },
  eyeIcon: {
    padding: spacing.xs,
  },
  error: {
    fontSize: fontSize.xs,
    fontFamily: typography.fontFamily,
    marginTop: spacing.xs,
  },
});
