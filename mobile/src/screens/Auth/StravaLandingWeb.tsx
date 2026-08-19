import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../../components/Logo';
import { borderRadius, fontSize, spacing } from '../../theme';

const BG = '#030914';
const SURFACE = '#081321';
const SURFACE_2 = '#101B2B';
const BORDER = 'rgba(58,134,255,0.18)';
const TEXT = '#FFFFFF';
const MUTED = '#A7ABB3';
const BLUE = '#3A86FF';
const CYAN = '#00B4D8';
const GREEN = '#22D3A6';

const INSIGHTS = [
  { value: 'GPS', label: 'ao vivo', icon: 'navigate-outline' as const },
  { value: 'Match', label: 'por esporte', icon: 'people-outline' as const },
  { value: 'XP', label: 'por consistencia', icon: 'sparkles-outline' as const },
];

const FEATURES = [
  {
    icon: 'map-outline' as const,
    title: 'Mapa inteligente',
    desc: 'Veja rotas, eventos, pontos de treino e treinos ao vivo em uma experiencia visual limpa.',
    tone: BLUE,
  },
  {
    icon: 'radio-outline' as const,
    title: 'Live tracking',
    desc: 'Compartilhe seu treino em tempo real com quem precisa acompanhar sua rota.',
    tone: CYAN,
  },
  {
    icon: 'people-outline' as const,
    title: 'Descobrir pessoas',
    desc: 'Encontre atletas proximos por modalidade, ritmo, objetivo e disponibilidade.',
    tone: GREEN,
  },
  {
    icon: 'trophy-outline' as const,
    title: 'Metas e ranking',
    desc: 'Transforme consistencia em streaks, conquistas, progresso e disputas saudaveis.',
    tone: '#8338EC',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Comunidade',
    desc: 'Combine treinos, participe de grupos e acompanhe o feed de quem treina com voce.',
    tone: '#FF9F43',
  },
  {
    icon: 'analytics-outline' as const,
    title: 'Evolucao clara',
    desc: 'Acompanhe distancia, tempo, ritmo, calorias, sequencia e historico de treinos.',
    tone: '#FF6868',
  },
];

const STEPS = [
  { title: 'Conecte', desc: 'Monte seu perfil, escolha esportes e encontre pessoas compativeis.' },
  { title: 'Treine', desc: 'Use GPS, mapa, metas e check-ins para registrar sua jornada.' },
  { title: 'Supere', desc: 'Compartilhe no feed, ganhe XP, mantenha sequencia e suba no ranking.' },
];

const PLANS = [
  {
    name: 'Free',
    price: 'Gratis',
    desc: 'Para comecar hoje',
    perks: ['Feed e perfil esportivo', 'Tracking GPS', 'Descobrir atletas', 'Grupos e chat'],
    cta: 'Comecar gratis',
    active: true,
  },
  {
    name: 'Premium',
    price: 'Em breve',
    desc: 'Para evoluir com mais dados',
    perks: ['Metas avancadas', 'Heatmaps pessoais', 'Relatorios melhores', 'Coach inteligente'],
    cta: 'Em breve',
    active: false,
  },
  {
    name: 'Pro',
    price: 'Em breve',
    desc: 'Para atletas e treinadores',
    perks: ['Painel de performance', 'Turmas e desafios', 'Analises anuais', 'Recursos de equipe'],
    cta: 'Em breve',
    active: false,
  },
];

const TESTIMONIALS = [
  {
    name: 'Ana Ferreira',
    role: 'Corrida de rua',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    text: 'O Sync deixou meu treino mais social. Consigo combinar corrida e ainda acompanhar minha evolucao.',
  },
  {
    name: 'Marina Lopes',
    role: 'Ciclismo',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
    text: 'A parte de mapa e grupos e exatamente o que faltava para eu descobrir rotas melhores.',
  },
  {
    name: 'Rafael Souza',
    role: 'Academia e corrida',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    text: 'Gosto da mistura de treino, ranking e comunidade. Parece app de esporte de verdade.',
  },
];

interface Props {
  onStart: () => void;
  onLogin: () => void;
  onDemo?: () => void;
}

export default function StravaLandingWeb({ onStart, onLogin, onDemo }: Props) {
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const isWide = width >= 1100;
  const compactNav = width < 980;
  const stackedNav = width < 680;
  const cardWidth = isWide ? 350 : Math.min(width - 48, 340);

  const scrollToSection = (key: string) => {
    const y = sectionY.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 76, 0), animated: true });
  };

  return (
    <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={[BG, '#04111F', BG]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.nav, stackedNav && styles.navStacked]}>
        <TouchableOpacity
          style={styles.navBrand}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          accessibilityRole="button"
          accessibilityLabel="Voltar ao inicio"
        >
          <Logo size={34} variant="filled" />
          <Text style={styles.navBrandText}>SYNC</Text>
        </TouchableOpacity>

        <View style={[styles.navLinks, compactNav && styles.navLinksCompact, stackedNav && styles.navLinksStacked]}>
          {!compactNav && (
            <>
              {[
                { label: 'Recursos', key: 'features' },
                { label: 'Planos', key: 'plans' },
                { label: 'Comunidade', key: 'community' },
              ].map((item) => (
                <TouchableOpacity key={item.key} onPress={() => scrollToSection(item.key)} style={styles.navLinkTouch}>
                  <Text style={styles.navLink}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          <TouchableOpacity onPress={onLogin}>
            <Text style={styles.navLogin}>Entrar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navCta} onPress={onStart}>
            <Text style={styles.navCtaText}>Criar conta</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View style={[styles.hero, { opacity: fade }]}>
        <View style={styles.heroCopy}>
          <View style={styles.eyebrowPill}>
            <Ionicons name="sparkles-outline" size={15} color={CYAN} />
            <Text style={styles.eyebrowText}>Conecte. Treine. Supere.</Text>
          </View>

          <Text style={styles.heroTitle}>
            O app social para quem leva esporte a serio.
          </Text>
          <Text style={styles.heroSubtitle}>
            Encontre parceiros, registre treinos, acompanhe sua evolucao e participe de uma comunidade feita para sair do plano.
          </Text>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
              <LinearGradient
                colors={[BLUE, CYAN]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonInner}
              >
                <Text style={styles.primaryButtonText}>Comecar gratis</Text>
                <Ionicons name="arrow-forward" size={18} color={TEXT} />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onLogin}>
              <Text style={styles.secondaryButtonText}>Ja tenho conta</Text>
            </TouchableOpacity>
            {onDemo && (
              <TouchableOpacity style={styles.demoButton} onPress={onDemo}>
                <Ionicons name="person-circle-outline" size={18} color={CYAN} />
                <Text style={styles.demoButtonText}>Testar demo</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.insightsRow}>
            {INSIGHTS.map((item) => (
              <View key={item.label} style={styles.insightCard}>
                <Ionicons name={item.icon} size={18} color={CYAN} />
                <Text style={styles.insightValue}>{item.value}</Text>
                <Text style={styles.insightLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.heroVisual}>
          <View style={styles.logoOrb}>
            <Logo size={110} variant="filled" />
          </View>
          <View style={[styles.floatCard, styles.floatFeed]}>
            <View style={styles.feedHeader}>
              <View style={styles.feedAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.floatTitle}>Ana Ferreira</Text>
                <Text style={styles.floatMuted}>Corrida leve hoje</Text>
              </View>
              <Ionicons name="heart" size={20} color="#FF6868" />
            </View>
            <Text style={styles.feedText}>Mantendo constancia, um dia de cada vez.</Text>
            <View style={styles.feedChip}>
              <Text style={styles.feedChipText}>5km</Text>
            </View>
          </View>
          <View style={[styles.floatCard, styles.floatStats]}>
            <Ionicons name="water" size={26} color={BLUE} />
            <View>
              <Text style={styles.floatNumber}>7</Text>
              <Text style={styles.floatMuted}>dias consecutivos</Text>
            </View>
          </View>
          <View style={[styles.floatCard, styles.floatMap]}>
            <Ionicons name="location-outline" size={18} color={GREEN} />
            <Text style={styles.floatMuted}>3 atletas por perto</Text>
          </View>
        </View>
      </Animated.View>

      <View
        style={styles.section}
        onLayout={(e) => { sectionY.current.features = e.nativeEvent.layout.y; }}
      >
        <Text style={styles.sectionEyebrow}>RECURSOS</Text>
        <Text style={styles.sectionTitle}>Tudo para treinar melhor, em um so lugar.</Text>
        <View style={styles.featureGrid}>
          {FEATURES.map((item) => (
            <View key={item.title} style={[styles.featureCard, { width: cardWidth }]}>
              <View style={[styles.featureIcon, { backgroundColor: item.tone + '1F', borderColor: item.tone + '55' }]}>
                <Ionicons name={item.icon} size={24} color={item.tone} />
              </View>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.band}>
        <View style={styles.bandCopy}>
          <Text style={styles.sectionEyebrow}>COMO FUNCIONA</Text>
          <Text style={styles.sectionTitle}>Do primeiro treino ao primeiro ranking.</Text>
        </View>
        <View style={styles.stepsRow}>
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <View
        style={styles.section}
        onLayout={(e) => { sectionY.current.plans = e.nativeEvent.layout.y; }}
      >
        <Text style={styles.sectionEyebrow}>PLANOS</Text>
        <Text style={styles.sectionTitle}>Comece gratis. Evolua quando fizer sentido.</Text>
        <View style={styles.planGrid}>
          {PLANS.map((plan) => (
            <View key={plan.name} style={[styles.planCard, plan.active && styles.planCardActive, { width: cardWidth }]}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planDesc}>{plan.desc}</Text>
              <View style={styles.perks}>
                {plan.perks.map((perk) => (
                  <View key={perk} style={styles.perkRow}>
                    <Ionicons name="checkmark-circle" size={17} color={plan.active ? CYAN : MUTED} />
                    <Text style={styles.perkText}>{perk}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.planButton, plan.active && styles.planButtonActive]}
                onPress={onStart}
                disabled={!plan.active}
              >
                <Text style={[styles.planButtonText, plan.active && styles.planButtonActiveText]}>
                  {plan.cta}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      <View
        style={styles.section}
        onLayout={(e) => { sectionY.current.community = e.nativeEvent.layout.y; }}
      >
        <Text style={styles.sectionEyebrow}>COMUNIDADE</Text>
        <Text style={styles.sectionTitle}>Treinar fica mais facil quando alguem vai junto.</Text>
        <View style={styles.testGrid}>
          {TESTIMONIALS.map((item) => (
            <View key={item.name} style={[styles.testCard, { width: cardWidth }]}>
              <View style={styles.testUser}>
                <Image source={{ uri: item.avatar }} style={styles.testAvatar} />
                <View>
                  <Text style={styles.testName}>{item.name}</Text>
                  <Text style={styles.testRole}>{item.role}</Text>
                </View>
              </View>
              <Text style={styles.testText}>"{item.text}"</Text>
            </View>
          ))}
        </View>
      </View>

      <LinearGradient
        colors={['rgba(58,134,255,0.16)', 'rgba(0,180,216,0.08)', 'rgba(3,9,20,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.finalCta}
      >
        <Logo size={74} variant="filled" />
        <Text style={styles.finalTitle}>Pronto para sincronizar seu proximo treino?</Text>
        <Text style={styles.finalDesc}>Crie sua conta e comece com feed, perfil, tracking, mapa e comunidade.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onStart}>
          <LinearGradient
            colors={[BLUE, CYAN]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButtonInner}
          >
            <Text style={styles.primaryButtonText}>Criar conta gratuita</Text>
            <Ionicons name="arrow-forward" size={18} color={TEXT} />
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.footer}>
        <View style={styles.footerBrand}>
          <Logo size={30} variant="filled" />
          <Text style={styles.navBrandText}>SYNC</Text>
        </View>
        <Text style={styles.footerText}>Tinder de esportes. Feito para conectar quem se move.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingBottom: 0,
  },
  nav: {
    minHeight: 74,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(3,9,20,0.78)',
  },
  navStacked: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
    minWidth: 150,
  },
  navBrandText: {
    color: TEXT,
    fontSize: fontSize.lg,
    fontWeight: '900',
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'nowrap',
    justifyContent: 'flex-end',
    flexShrink: 1,
    minWidth: 0,
  },
  navLinksCompact: {
    gap: spacing.md,
  },
  navLinksStacked: {
    width: '100%',
    justifyContent: 'space-between',
  },
  navLinkTouch: {
    flexShrink: 0,
  },
  navLink: {
    color: MUTED,
    fontSize: fontSize.sm,
    fontWeight: '700',
    flexShrink: 0,
  },
  navLogin: {
    color: TEXT,
    fontSize: fontSize.sm,
    fontWeight: '800',
    flexShrink: 0,
  },
  navCta: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: BLUE,
    flexShrink: 0,
  },
  navCtaText: {
    color: TEXT,
    fontSize: fontSize.sm,
    fontWeight: '900',
  },
  hero: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 72,
    paddingBottom: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 56,
    flexWrap: 'wrap',
  },
  heroCopy: {
    flex: 1,
    minWidth: 320,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(58,134,255,0.10)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  eyebrowText: {
    color: CYAN,
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
  heroTitle: {
    color: TEXT,
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '900',
    maxWidth: 720,
  },
  heroSubtitle: {
    color: MUTED,
    fontSize: fontSize.lg,
    lineHeight: 30,
    marginTop: spacing.lg,
    maxWidth: 620,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    flexWrap: 'wrap',
  },
  primaryButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 6,
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: TEXT,
    fontSize: fontSize.md,
    fontWeight: '900',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secondaryButtonText: {
    color: TEXT,
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  demoButtonText: {
    color: CYAN,
    fontWeight: '800',
  },
  insightsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    flexWrap: 'wrap',
  },
  insightCard: {
    minWidth: 132,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(8,19,33,0.80)',
    padding: spacing.md,
  },
  insightValue: {
    color: TEXT,
    fontSize: fontSize.lg,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  insightLabel: {
    color: MUTED,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  heroVisual: {
    flex: 0.85,
    minWidth: 320,
    minHeight: 470,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(8,19,33,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoOrb: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: 'rgba(0,180,216,0.44)',
    backgroundColor: 'rgba(3,9,20,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: CYAN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 30,
  },
  floatCard: {
    position: 'absolute',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(16,27,43,0.92)',
    padding: spacing.md,
  },
  floatFeed: {
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  feedAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GREEN,
  },
  feedText: {
    color: TEXT,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  feedChip: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(58,134,255,0.16)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  feedChipText: {
    color: BLUE,
    fontSize: fontSize.xs,
    fontWeight: '900',
  },
  floatStats: {
    left: spacing.lg,
    top: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  floatMap: {
    right: spacing.lg,
    top: spacing.xl + 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  floatTitle: {
    color: TEXT,
    fontWeight: '900',
  },
  floatNumber: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 28,
  },
  floatMuted: {
    color: MUTED,
    fontSize: fontSize.xs,
  },
  section: {
    maxWidth: 1180,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 76,
  },
  sectionEyebrow: {
    color: CYAN,
    fontSize: fontSize.xs,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '900',
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 760,
    marginBottom: spacing.xl,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  featureCard: {
    minHeight: 232,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: spacing.lg,
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  featureTitle: {
    color: TEXT,
    fontSize: fontSize.lg,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  featureDesc: {
    color: MUTED,
    fontSize: fontSize.sm,
    lineHeight: 22,
  },
  band: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 76,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(8,19,33,0.54)',
  },
  bandCopy: {
    maxWidth: 900,
    alignSelf: 'center',
  },
  stepsRow: {
    maxWidth: 1050,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  stepCard: {
    width: 310,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE_2,
    padding: spacing.lg,
  },
  stepNumber: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  stepNumberText: {
    color: TEXT,
    fontWeight: '900',
  },
  stepTitle: {
    color: TEXT,
    fontSize: fontSize.lg,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  stepDesc: {
    color: MUTED,
    fontSize: fontSize.sm,
    lineHeight: 22,
  },
  planGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  planCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: spacing.lg,
  },
  planCardActive: {
    borderColor: 'rgba(0,180,216,0.52)',
    backgroundColor: 'rgba(58,134,255,0.10)',
  },
  planName: {
    color: TEXT,
    fontSize: fontSize.xl,
    fontWeight: '900',
  },
  planPrice: {
    color: CYAN,
    fontSize: 34,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  planDesc: {
    color: MUTED,
    fontSize: fontSize.sm,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  perks: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  perkText: {
    color: MUTED,
    fontSize: fontSize.sm,
    flex: 1,
  },
  planButton: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  planButtonActive: {
    backgroundColor: BLUE,
    borderColor: BLUE,
  },
  planButtonText: {
    color: MUTED,
    fontWeight: '900',
  },
  planButtonActiveText: {
    color: TEXT,
  },
  testGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  testCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    padding: spacing.lg,
  },
  testUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  testAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  testName: {
    color: TEXT,
    fontWeight: '900',
  },
  testRole: {
    color: CYAN,
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  testText: {
    color: MUTED,
    fontSize: fontSize.sm,
    lineHeight: 22,
  },
  finalCta: {
    marginHorizontal: spacing.xl,
    marginVertical: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: spacing.xl,
    paddingVertical: 72,
    alignItems: 'center',
  },
  finalTitle: {
    color: TEXT,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '900',
    textAlign: 'center',
    maxWidth: 760,
    marginTop: spacing.lg,
  },
  finalDesc: {
    color: MUTED,
    fontSize: fontSize.md,
    textAlign: 'center',
    maxWidth: 620,
    lineHeight: 25,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  footerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  footerText: {
    color: MUTED,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
