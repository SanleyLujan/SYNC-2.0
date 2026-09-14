import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Easing, ScrollView, TouchableOpacity, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, CommonActions } from '@react-navigation/native';
import { HomeStackParamList } from '../../navigation/types';
import { fontSize, spacing, borderRadius } from '../../theme';
import { AppTheme } from '../../theme/colors';
import { useThemeStore } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarHeight } from '../../navigation/MainTabNavigator';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuthStore } from '../../store/authStore';

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'MatchScreen'>;
  route: RouteProp<HomeStackParamList, 'MatchScreen'>;
};

export default function MatchScreen({ navigation, route }: Props) {
  const theme = useThemeStore(state => state.theme);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { matchId, userName, userId, userAvatar } = route.params;
  const me = useAuthStore((s) => s.user);
  const myAvatar = me?.avatarUrl || (me as any)?.profilePhotos?.[0];
  const defaultAvatar = require('../../assets/images/default-avatar.png');
  const reduceMotion = useReduceMotion();
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartRotate = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const sparkle1 = useRef(new Animated.Value(0)).current;
  const sparkle2 = useRef(new Animated.Value(0)).current;
  const sparkle3 = useRef(new Animated.Value(0)).current;

  // Refs to hold loop animation handles for cleanup
  const sparkle1LoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const sparkle2LoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const sparkle3LoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const heartRotateLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Anuncia o match pra leitores de tela (acessibilidade)
    AccessibilityInfo.announceForAccessibility?.(`Deu match com ${userName}! Vocês querem treinar juntos.`);

    // Reduzir movimento: mostra tudo no estado final, sem animações
    if (reduceMotion) {
      heartScale.setValue(1);
      titleOpacity.setValue(1);
      subtitleOpacity.setValue(1);
      buttonsOpacity.setValue(1);
      return;
    }

    // Entrance animation sequence
    Animated.sequence([
      // Heart bounce in
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 3,
        tension: 80,
        useNativeDriver: true,
      }),
      // Heart pulse
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Sparkle animations
    const animateSparkle = (
      sparkle: Animated.Value,
      delay: number,
      loopRef: React.MutableRefObject<Animated.CompositeAnimation | null>,
    ) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(sparkle, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(sparkle, {
            toValue: 0,
            duration: 600,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loopRef.current = loop;
      loop.start();
    };

    animateSparkle(sparkle1, 0, sparkle1LoopRef);
    animateSparkle(sparkle2, 400, sparkle2LoopRef);
    animateSparkle(sparkle3, 800, sparkle3LoopRef);

    // Title fade in
    Animated.timing(titleOpacity, {
      toValue: 1,
      duration: 500,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // Subtitle fade in
    Animated.timing(subtitleOpacity, {
      toValue: 1,
      duration: 500,
      delay: 700,
      useNativeDriver: true,
    }).start();

    // Buttons slide up
    Animated.timing(buttonsOpacity, {
      toValue: 1,
      duration: 500,
      delay: 1000,
      useNativeDriver: true,
    }).start();

    // Heart slow rotation
    const heartLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heartRotate, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(heartRotate, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    heartRotateLoopRef.current = heartLoop;
    heartLoop.start();

    // Stop all loops on unmount to prevent memory leaks
    return () => {
      sparkle1LoopRef.current?.stop();
      sparkle2LoopRef.current?.stop();
      sparkle3LoopRef.current?.stop();
      heartRotateLoopRef.current?.stop();
    };
  }, []);

  const goToChat = () => {
    const parent = navigation.getParent();
    if (parent) {
      navigation.goBack();
      parent.dispatch(
        CommonActions.navigate({
          name: 'ChatTab',
          params: {
            screen: 'ChatRoom',
            initial: false,
            params: {
              matchId,
              userName,
              userId,
            },
          },
        }),
      );
    }
  };

  const rotate = heartRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-5deg', '5deg'],
  });

  return (
    <LinearGradient
      colors={[theme.background, theme.surfaceSecondary, theme.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: getTabBarHeight(insets.bottom) + 24 }]}>
        {/* Sparkles */}
        <Animated.View style={[styles.sparkle, styles.sparkle1, { opacity: sparkle1, transform: [{ scale: sparkle1 }] }]}>
          <Ionicons name="star" size={20} color={theme.primary} />
        </Animated.View>
        <Animated.View style={[styles.sparkle, styles.sparkle2, { opacity: sparkle2, transform: [{ scale: sparkle2 }] }]}>
          <Ionicons name="star" size={16} color={theme.primary} />
        </Animated.View>
        <Animated.View style={[styles.sparkle, styles.sparkle3, { opacity: sparkle3, transform: [{ scale: sparkle3 }] }]}>
          <Ionicons name="star" size={24} color={theme.primary} />
        </Animated.View>

        {/* Duas fotos (você + match) com coração no meio */}
        <Animated.View style={[styles.avatarsRow, { transform: [{ scale: heartScale }] }]}>
          <Image
            source={myAvatar ? { uri: myAvatar } : defaultAvatar}
            style={[styles.matchAvatar, { marginRight: -18 }]}
            contentFit="cover"
          />
          <Image
            source={userAvatar ? { uri: userAvatar } : defaultAvatar}
            style={[styles.matchAvatar, { marginLeft: -18 }]}
            contentFit="cover"
          />
          <Animated.View style={[styles.heartBadge, { transform: [{ rotate }] }]}>
            <Ionicons name="heart" size={26} color="#fff" />
          </Animated.View>
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>
          Deu Match!
        </Animated.Text>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text style={styles.subtitle} numberOfLines={3}>
            Você e <Text style={styles.userName}>{userName.length > 22 ? userName.slice(0, 22) + '…' : userName}</Text> querem treinar juntos!
          </Text>
          <View style={styles.matchBadge}>
            <Ionicons name="fitness" size={16} color={theme.textPrimary} />
            <Text style={styles.matchBadgeText}>Parceiro de treino encontrado</Text>
          </View>
        </Animated.View>

        {/* Buttons */}
        <Animated.View style={[styles.buttons, { opacity: buttonsOpacity, transform: [{ translateY: buttonsOpacity.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
          <TouchableOpacity
            onPress={goToChat}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
            style={[styles.btn, styles.sendBtn]}
          >
            <Text style={styles.sendText}>Enviar mensagem</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Continuar descobrindo"
            style={styles.btn}
          >
            <Text style={styles.continueText}>Continuar descobrindo</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  heartGlow: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: theme.primary,
    backgroundColor: theme.primarySoft,
  },
  heartBadge: {
    position: 'absolute',
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkle1: {
    top: '20%',
    left: '15%',
  },
  sparkle2: {
    top: '25%',
    right: '15%',
  },
  sparkle3: {
    top: '35%',
    left: '25%',
  },
  title: {
    fontSize: 52,
    fontWeight: '800',
    color: theme.textPrimary,
    marginTop: spacing.xl,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 26,
  },
  userName: {
    fontWeight: '800',
    color: theme.textPrimary,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
    alignSelf: 'center',
  },
  matchBadgeText: {
    fontSize: fontSize.xs,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  buttons: {
    width: '100%',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  btn: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendBtn: { backgroundColor: theme.primary },
  sendText: { color: theme.mode === 'dark' ? theme.background : theme.textPrimary, fontWeight: '800', fontSize: 16 },
  continueText: { color: theme.textPrimary, fontWeight: '700', fontSize: 16 },
});
