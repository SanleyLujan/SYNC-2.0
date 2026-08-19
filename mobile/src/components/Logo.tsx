import React from 'react';
import { Image, Text, View } from 'react-native';
import { useThemeStore } from '../store/themeStore';

interface LogoProps {
  size?: number;
  color?: string;
  variant?: 'plain' | 'filled';
}

const darkLogo = require('../assets/images/sync-logo-dark.png');
const lightLogo = require('../assets/images/sync-logo-light.png');

export default function Logo({ size = 48 }: LogoProps) {
  const mode = useThemeStore((s) => s.mode);
  const source = mode === 'light' ? lightLogo : darkLogo;

  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="Logo Sync"
    />
  );
}

export function LogoWithText({
  size = 48,
  textColor,
}: {
  size?: number;
  color?: string;
  textColor?: string;
}) {
  const theme = useThemeStore((s) => s.theme);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.18 }}>
      <Logo size={size} />
      <Text
        style={{
          color: textColor || theme.textPrimary,
          fontSize: size * 0.52,
          fontWeight: '800',
          letterSpacing: 0,
        }}
      >
        SYNC
      </Text>
    </View>
  );
}
