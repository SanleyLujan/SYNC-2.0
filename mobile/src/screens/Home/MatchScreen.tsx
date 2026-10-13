import Logo from '../../components/Logo';
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView, TouchableOpacity, AccessibilityInfo } from 'react-native';
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
import { useAppDimensions } from '../../hooks/useAppDimensions';

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'MatchScreen'>;
  route: RouteProp<HomeStackParamList, 'MatchScreen'>;
};

export default function MatchScreen({ navigation, route }: Props) {
  const theme = useThemeStore(state => state.theme);
  const { height } = useAppDimensions();
  const compact = height < 650;
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
  const insets = useSafeAreaInsets();
  const { matchId, userName, userId, userAvatar } = route.params;
  const me = useAuthStore((s) => s.user);
  const myAvatar = me?.avatarUrl || (me as any)?.profilePhotos?.[0];
  const defaultAvatar = require('../../assets/images/default-avatar.png');
  const reduceMotion = useReduceMotion();
  const logoScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(`Deu Sync com ${userName}! Agora vocês podem combinar um treino.`);

    // Reduzir movimento: mostra tudo no estado final, sem animações
    if (reduceMotion) {
      logoScale.setValue(1);
      titleOpacity.setValue(1);
      subtitleOpacity.setValue(1);
      buttonsOpacity.setValue(1);
      return;
    }

    Animated.spring(logoScale, {
      toValue: 1,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();

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

  return (
    <LinearGradient
      colors={[theme.background, theme.surfaceSecondary, theme.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: getTabBarHeight(insets.bottom) + 24 }]}>
        {/* Fotos separadas pela marca da conexão */}
        <Animated.View style={[styles.avatarsRow, { transform: [{ scale: logoScale }] }]}>
          <Image
            source={myAvatar ? { uri: myAvatar } : defaultAvatar}
            style={styles.matchAvatar}
            contentFit="cover"
          />
          <View style={styles.logoBadge}>
            <Logo size={compact ? 34 : 40} />
          </View>
          <Image
            source={userAvatar ? { uri: userAvatar } : defaultAvatar}
            style={styles.matchAvatar}
            contentFit="cover"
          />
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[styles.title, { opacity: titleOpacity }]}>
          Deu Sync
        </Animated.Text>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleOpacity }}>
          <Text style={styles.subtitle} numberOfLines={3}>
            Você e <Text style={styles.userName}>{userName.length > 22 ? userName.slice(0, 22) + '…' : userName}</Text> agora podem combinar um treino.
          </Text>
          <View style={styles.matchBadge}>
            <Ionicons name="barbell-outline" size={16} color={theme.textPrimary} />
            <Text style={styles.matchBadgeText}>Conexão para treinar</Text>
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

const createStyles = (theme: AppTheme, compact: boolean) => StyleSheet.create({
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
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: compact ? 8 : 10,
  },
  matchAvatar: {
    width: compact ? 82 : 100,
    height: compact ? 82 : 100,
    borderRadius: compact ? 41 : 50,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.primarySoft,
  },
  logoBadge: {
    width: compact ? 52 : 56,
    height: compact ? 52 : 56,
    borderRadius: compact ? 16 : 18,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: {
    fontSize: compact ? 44 : 52,
    fontWeight: '800',
    color: theme.textPrimary,
    marginTop: compact ? spacing.md : spacing.xl,
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
    marginTop: compact ? spacing.lg : spacing.xxl,
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
  sendText: { color: theme.primaryText, fontWeight: '800', fontSize: 16 },
  continueText: { color: theme.textPrimary, fontWeight: '700', fontSize: 16 },
});
