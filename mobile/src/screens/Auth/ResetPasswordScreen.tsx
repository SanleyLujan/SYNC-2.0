import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authService } from '../../services/auth.service';
import { borderRadius, colors, fontSize, spacing, typography } from '../../theme';

type Props = { token: string };

export default function ResetPasswordScreen({ token }: Props) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (loading) return;
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use pelo menos 8 caracteres, incluindo letras e números.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não conferem.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : message || 'Link inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.href = '/';
  };

  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <Ionicons
          name={done ? 'checkmark-circle' : 'lock-closed-outline'}
          size={48}
          color={done ? colors.success : colors.primary}
        />
        <Text style={styles.title}>{done ? 'Senha redefinida' : 'Crie uma nova senha'}</Text>
        <Text style={styles.subtitle}>
          {done
            ? 'Sua nova senha já está ativa. Volte ao Sync para entrar.'
            : 'O link só pode ser usado uma vez e expira em 1 hora.'}
        </Text>

        {!done && (
          <>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Nova senha"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
              accessibilityLabel="Nova senha"
            />
            <TextInput
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder="Confirme a nova senha"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              style={styles.input}
              accessibilityLabel="Confirmar nova senha"
            />
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}

        <Pressable
          onPress={done ? goToLogin : submit}
          disabled={loading}
          style={[styles.button, loading && { opacity: 0.6 }]}
        >
          <LinearGradient colors={colors.gradientPrimary} style={styles.buttonInner}>
            <Text style={styles.buttonText}>
              {done ? 'Voltar para o Sync' : loading ? 'Salvando…' : 'Salvar nova senha'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    width: '100%',
    minHeight: 50,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  error: {
    alignSelf: 'stretch',
    color: colors.error,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  button: {
    alignSelf: 'stretch',
    overflow: 'hidden',
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  buttonInner: { alignItems: 'center', paddingVertical: 14 },
  buttonText: { color: colors.primaryText, fontWeight: '700', fontSize: fontSize.md },
});
