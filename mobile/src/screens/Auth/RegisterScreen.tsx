import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';
import { colors, fontSize, spacing, borderRadius, typography } from '../../theme';
import { heroImages } from '../../theme/images';
import Input from '../../components/ui/Input';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { showToast } from '../../components/ui/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

const ACCENT = colors.primary;

// Formata os dígitos do CPF como 000.000.000-00 para exibição.
function formatCPF(digits: string): string {
  const d = (digits || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Valida CPF pelos dígitos verificadores (rejeita inventado/repetido).
function isValidCPF(value: string): boolean {
  const cpf = (value || '').replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

export default function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [cpf, setCpf] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const register = useAuthStore((s) => s.register);

  const fade = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(slideY, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Nome obrigatório';
    else if (name.trim().length < 2) newErrors.name = 'Nome muito curto';
    if (!email.trim()) newErrors.email = 'Email obrigatório';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email inválido';
    if (password.length < 8) newErrors.password = 'Mínimo 8 caracteres';
    else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
      newErrors.password = 'Senha precisa de letras e números';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Senhas não conferem';
    if (!isValidCPF(cpf)) newErrors.cpf = 'CPF inválido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid =
    name.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    password === confirmPassword &&
    isValidCPF(cpf) &&
    acceptedTerms;

  const handleRegister = async () => {
    if (!validate()) {
      const firstError = Object.values(errors)[0];
      if (firstError) showToast(firstError, 'error');
      else showToast('Verifique os dados do formulário', 'error');
      return;
    }
    if (!acceptedTerms) {
      showToast('Aceite os termos pra continuar.', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await register(name.trim(), email.trim().toLowerCase(), password, confirmPassword, {
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        gender: gender || undefined,
        cpf: cpf.replace(/\D/g, '') || undefined,
      });
      // Popup de sucesso antes de cair na selecao de perguntas (onboarding)
      if (result.emailVerificationSent === false) {
        showToast('Conta criada, mas o email de confirmação não saiu. Confira o Resend/SMTP no Render.', 'info');
      } else {
        showToast('Conta criada! Enviamos um link para confirmar seu email.', 'success');
      }
    } catch (error: any) {
      const status = error.response?.status;
      const msg = error.response?.data?.message;
      const detail = Array.isArray(msg) ? msg.join(' • ') : msg;
      if (status === 409) {
        // E-mail já cadastrado (backend é vago de propósito p/ anti-enumeração).
        // Orientamos o usuário legítimo a entrar em vez de só dizer "dados inválidos".
        showToast('Esse e-mail pode já ter conta. Tente fazer login ou recuperar a senha.', 'error');
      } else if (!error.response) {
        // Sem resposta = falha de rede/servidor fora do ar
        showToast('Sem conexão com o servidor. Verifique sua internet e tente de novo.', 'error');
      } else {
        showToast(detail || 'Não foi possível criar sua conta.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (password.length === 0) return { level: 0, label: '', color: 'rgba(255,255,255,0.15)' };
    if (password.length < 8) return { level: 1, label: 'Fraca (mín 8)', color: colors.error };
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
      return { level: 2, label: 'Precisa letras + números', color: colors.warning };
    if (/[A-Z]/.test(password) && password.length >= 10) return { level: 4, label: 'Forte', color: colors.success };
    return { level: 3, label: 'Boa', color: colors.blueAccent };
  };
  const strength = getPasswordStrength();

  return (
    <View style={styles.root}>
      <ImageBackground
        source={{ uri: heroImages.runnerSunrise }}
        style={styles.hero}
        resizeMode="cover"
      >
        <LinearGradient
          colors={colors.gradientHero}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -24}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={[styles.centerStage, { paddingTop: Math.max(insets.top + 16, 56) }]}>
            <Animated.View
              style={[styles.content, { opacity: fade, transform: [{ translateY: slideY }] }]}
            >
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Voltar"
              >
                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.titleBlock}>
                <Text style={styles.title}>Criar{'\n'}<Text style={styles.titleAccent}>sua conta.</Text></Text>
                <Text style={styles.subtitle}>
                  Encontre parceiros de treino na sua região.
                </Text>
              </View>

              <View style={styles.form}>
                <Input
                  label="Nome"
                  placeholder="Seu nome completo"
                  value={name}
                  onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: '' })); }}
                  error={errors.name}
                  autoCapitalize="words"
                />
                <Input
                  label="Email"
                  placeholder="seu@email.com"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }}
                  error={errors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Input
                  label="Senha"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
                  error={errors.password}
                  isPassword
                />

                {password.length > 0 && (
                  <View style={styles.strengthRow}>
                    <View style={styles.strengthBar}>
                      {[1, 2, 3, 4].map((i) => (
                        <View
                          key={i}
                          style={[
                            styles.strengthSegment,
                            { backgroundColor: i <= strength.level ? strength.color : colors.surfaceSecondary },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                  </View>
                )}

                <Input
                  label="Confirmar senha"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
                  error={errors.confirmPassword}
                  isPassword
                />

                {confirmPassword.length > 0 && (
                  <View style={styles.matchRow}>
                    <Ionicons
                      name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={password === confirmPassword ? colors.success : colors.error}
                    />
                    <Text style={[styles.matchText, { color: password === confirmPassword ? colors.success : colors.error }]}>
                      {password === confirmPassword ? 'Senhas conferem' : 'Senhas não conferem'}
                    </Text>
                  </View>
                )}

                <View style={styles.rowInputs}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Peso (kg)"
                      placeholder="Ex: 70"
                      value={weightKg}
                      onChangeText={(v) => setWeightKg(v.replace(/[^0-9.,]/g, ''))}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Altura (cm)"
                      placeholder="Ex: 175"
                      value={heightCm}
                      onChangeText={(v) => setHeightCm(v.replace(/[^0-9.,]/g, ''))}
                      keyboardType="decimal-pad"
                      maxLength={5}
                    />
                  </View>
                </View>

                <Input
                  label="CPF"
                  placeholder="000.000.000-00 — usado para sua segurança"
                  value={formatCPF(cpf)}
                  onChangeText={(v) => { setCpf(v.replace(/\D/g, '').slice(0, 11)); setErrors((e) => ({ ...e, cpf: '' })); }}
                  keyboardType="number-pad"
                  maxLength={14}
                  error={errors.cpf}
                />

                <Text style={styles.genderLabel}>Sexo</Text>
                <View style={styles.genderRow}>
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGender(gender === g ? '' : g)}
                      style={[
                        styles.genderPill,
                        gender === g && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.genderPillText, gender === g && { color: colors.primaryText, fontWeight: '600' }]}>
                        {g === 'male' ? 'Masculino' : g === 'female' ? 'Feminino' : 'Outro'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.termsRow}>
                <TouchableOpacity
                  onPress={() => setAcceptedTerms(!acceptedTerms)}
                  hitSlop={10}
                  style={{ paddingRight: 6 }}
                >
                  <Ionicons
                    name={acceptedTerms ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={acceptedTerms ? ACCENT : colors.textMuted}
                  />
                </TouchableOpacity>
                <Text style={styles.termsText}>
                  Aceito os{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => navigation.navigate('Terms')}
                  >
                    termos de uso
                  </Text>
                  {' '}e{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => navigation.navigate('Privacy')}
                  >
                    privacidade
                  </Text>
                </Text>
              </View>

              <Pressable
                onPress={handleRegister}
                disabled={!isFormValid || loading}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!isFormValid || loading) && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <LinearGradient
                  colors={colors.gradientPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtnInner}
                >
                  {loading ? (
                    <Text style={styles.primaryBtnText}>Criando…</Text>
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Criar conta</Text>
                      <Ionicons name="arrow-forward" size={18} color={colors.primaryText} />
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.loginLink}
              >
                <Text style={styles.loginText}>
                  Já tem conta?{' '}
                  <Text style={styles.loginTextBold}>Fazer login</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  scroll: { flexGrow: 1 },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  content: { width: '100%', maxWidth: 440 },
  backButton: {
    width: 44, height: 44, borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleBlock: { marginTop: spacing.lg, marginBottom: spacing.lg },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  titleAccent: {
    color: ACCENT,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontFamily: typography.fontFamily,
    marginTop: spacing.sm,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  strengthRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginTop: -spacing.sm, marginBottom: spacing.sm,
  },
  strengthBar: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: fontSize.xs, fontWeight: '600' },
  matchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: -spacing.sm, marginBottom: spacing.sm,
  },
  matchText: { fontSize: fontSize.xs, fontWeight: '500' },
  rowInputs: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  genderLabel: {
    fontSize: fontSize.sm, fontWeight: '600',
    color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs,
    fontFamily: typography.fontFamily,
  },
  genderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  genderPill: {
    flex: 1, paddingVertical: 12, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.surfaceSecondary,
    minHeight: 44,
  },
  genderPillText: { fontSize: fontSize.sm, color: colors.textSecondary, fontFamily: typography.fontFamily },
  termsRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm, marginBottom: spacing.lg,
  },
  termsText: {
    flex: 1, fontSize: fontSize.sm,
    color: colors.textSecondary, lineHeight: 20, fontFamily: typography.fontFamily,
  },
  termsLink: { color: ACCENT, fontWeight: '600' },
  primaryBtn: {
    borderRadius: borderRadius.md, overflow: 'hidden',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28, shadowRadius: 16, elevation: 8,
  },
  primaryBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  primaryBtnText: {
    color: colors.primaryText, fontSize: 16, fontFamily: typography.fontFamily, fontWeight: '600', letterSpacing: 0,
  },
  loginLink: {
    alignItems: 'center', marginTop: spacing.xl, paddingBottom: spacing.lg,
  },
  loginText: { fontSize: fontSize.sm, color: colors.textSecondary, fontFamily: typography.fontFamily },
  loginTextBold: { color: ACCENT, fontWeight: '700' },
});
