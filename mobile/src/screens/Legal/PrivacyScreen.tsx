// Política de privacidade — texto estático
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontSize, spacing } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PrivacyScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#15152E', '#0E0E1E', '#0A0A0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top + 10, 48) }]}
      >
        <TouchableOpacity
          onPress={() => navigation?.goBack?.()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Política de Privacidade</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.date}>Última atualização: 05/09/2026</Text>

        <Text style={styles.h2}>1. Dados que coletamos</Text>
        <Text style={styles.p}>
          Coletamos apenas os dados necessários para a funcionalidade do app:
          {'\n\n'}• Nome, email e senha (hash bcrypt) para autenticação
          {'\n'}• Localização GPS APENAS quando você usa o tracking ou Discovery
          {'\n'}• Atividades esportivas (km, pace, rota) que você cria voluntariamente
          {'\n'}• Avatar e bio (opcional)
          {'\n'}• Selfie e documento frente/verso somente quando você solicita voluntariamente o selo de perfil verificado
        </Text>

        <Text style={styles.h2}>2. Como usamos seus dados</Text>
        <Text style={styles.p}>
          • Para fazer matching com outros atletas próximos
          {'\n'}• Para calcular suas estatísticas pessoais
          {'\n'}• Para enviar notificações relevantes (você pode desativar)
          {'\n'}• Para análise manual de pedidos de verificação por administradores autorizados
          {'\n'}• NUNCA vendemos seus dados a terceiros
        </Text>

        <Text style={styles.h2}>3. Compartilhamento</Text>
        <Text style={styles.p}>
          Sua rota completa de atividade fica disponível somente para você. No Discovery, pessoas com match e permissão de mapa recebem apenas uma posição aproximada. Ao criar voluntariamente um link de acompanhamento, quem possuir esse link temporário poderá acompanhar aquela atividade.
        </Text>

        <Text style={styles.h2}>4. Seus direitos (LGPD/GDPR)</Text>
        <Text style={styles.p}>
          Você pode a qualquer momento:
          {'\n\n'}• Exportar todos seus dados (Configurações → Exportar dados)
          {'\n'}• Anonimizar sua conta (Configurações → Apagar minha conta)
          {'\n'}• Revogar sessões ativas
          {'\n'}• Solicitar correção de dados
        </Text>

        <Text style={styles.h2}>5. Segurança</Text>
        <Text style={styles.p}>
          • Senhas com bcrypt 12 rounds
          {'\n'}• Tokens JWT com rotação por família
          {'\n'}• HSTS + CSP + Helmet
          {'\n'}• IPs mascarados nos logs (LGPD compliant)
          {'\n'}• Account lockout após 5 tentativas erradas
          {'\n'}• Documentos de verificação sem EXIF/GPS, em bucket privado e com links temporários de 5 minutos
          {'\n'}• As três imagens de verificação são apagadas do storage após aprovação ou recusa; permanece somente o resultado da análise
        </Text>

        <Text style={styles.h2}>6. Cookies</Text>
        <Text style={styles.p}>
          Não usamos cookies de publicidade. Em Android/iOS, a sessão usa o armazenamento seguro do sistema. Na versão web, a sessão fica no armazenamento local do navegador e deve ser encerrada ao usar um computador compartilhado.
        </Text>

        <Text style={styles.h2}>7. Contato</Text>
        <Text style={styles.p}>
          Dúvidas? Envie para <Text style={styles.link}>privacy@sync.app</Text>
        </Text>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // paddingTop dinâmico via insets no JSX (notch/safe-area)
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: fontSize.lg, fontWeight: '800', color: colors.dark.text, letterSpacing: 0.3 },
  content: { padding: spacing.lg },
  date: { color: colors.dark.secondaryText, fontSize: 12, marginBottom: spacing.lg, fontStyle: 'italic' },
  h2: {
    color: colors.dark.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  p: { color: colors.dark.text, fontSize: 14, lineHeight: 22 },
  link: { color: '#FF6B35', fontWeight: '600' },
});
