import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../navigation/types';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { showToast } from '../../components/ui/Toast';
import { colors, spacing, borderRadius, typography, fontSize } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmailCode'>;

export default function VerifyEmailCodeScreen({ route, navigation }: Props) {
  const email = route.params.email;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // Cadastro com envio confirmado aguarda 60s. Em login pendente ou falha de
  // entrega, o usuário pode pedir um código imediatamente.
  const [seconds, setSeconds] = useState(route.params.sent === true ? 60 : 0);
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    if (route.params.sent === false) {
      showToast('A conta foi criada, mas o primeiro envio falhou. Tente reenviar.', 'info');
    }
  }, [route.params.sent]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const confirm = async () => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      const result = await authService.verifyEmailCode(email, code);
      await setAuth(result.user, result.accessToken, result.refreshToken, result.refreshExpiresAt);
      showToast('Email confirmado com sucesso.', 'success');
    } catch (error: any) {
      const message = error.response?.data?.message;
      showToast(Array.isArray(message) ? message.join(' ') : message || 'Código inválido ou expirado.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (seconds > 0 || resending) return;
    setResending(true);
    try {
      const result = await authService.requestVerification(email);
      if (result.emailVerificationSent === false) throw new Error('send failed');
      setSeconds(60);
      showToast('Novo código enviado.', 'success');
    } catch {
      showToast('Não foi possível enviar agora. Confira a configuração do Resend.', 'error');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.root}>
      <Pressable onPress={() => navigation.navigate('Login')} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.panel}>
        <Ionicons name="mail-unread-outline" size={48} color={colors.primary} />
        <Text style={styles.title}>Confirme seu email</Text>
        <Text style={styles.subtitle}>Digite o código de 6 dígitos enviado para</Text>
        <Text style={styles.email}>{email}</Text>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          style={styles.code}
          placeholder="000000"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={confirm}
        />
        <Pressable onPress={confirm} disabled={code.length !== 6 || loading} style={[styles.button, (code.length !== 6 || loading) && styles.disabled]}>
          <LinearGradient colors={colors.gradientPrimary} style={styles.buttonInner}>
            {loading ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Confirmar email</Text>}
          </LinearGradient>
        </Pressable>
        <Pressable onPress={resend} disabled={seconds > 0 || resending} style={styles.resend}>
          <Text style={[styles.resendText, seconds > 0 && styles.muted]}>
            {resending ? 'Enviando...' : seconds > 0 ? `Reenviar em ${seconds}s` : 'Reenviar código'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', padding: spacing.lg },
  back: { position: 'absolute', top: 48, left: 24, padding: 10, zIndex: 2 },
  panel: { width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.xl },
  title: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.md },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.md, marginTop: spacing.sm, textAlign: 'center' },
  email: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700', marginTop: 4 },
  code: { width: '100%', height: 64, marginTop: spacing.xl, backgroundColor: colors.input, borderWidth: 1.5, borderColor: colors.primary, borderRadius: borderRadius.md, color: colors.textPrimary, textAlign: 'center', fontSize: 30, fontWeight: '700', letterSpacing: 10 },
  button: { width: '100%', marginTop: spacing.lg, borderRadius: borderRadius.md, overflow: 'hidden' },
  disabled: { opacity: 0.5 },
  buttonInner: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.primaryText, fontSize: fontSize.md, fontWeight: '700' },
  resend: { marginTop: spacing.lg, padding: spacing.sm },
  resendText: { color: colors.primary, fontWeight: '700' },
  muted: { color: colors.textMuted },
});
