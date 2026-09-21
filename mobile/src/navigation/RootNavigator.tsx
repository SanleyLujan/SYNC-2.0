import React, { useEffect } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { useAuthStore } from '../store/authStore';
import { getCurrentLocation } from '../services/location.service';
import { registerForPushNotifications } from '../services/push-notifications.service';
import api from '../services/api';

import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainTabNavigator from './MainTabNavigator';
import NetworkBanner from '../components/NetworkBanner';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import { useAppPresence } from '../hooks/useAppPresence';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, user, isLoading, loadStoredAuth, setUser } = useAuthStore();
  useAppPresence(isAuthenticated && user ? user.id : null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Sincroniza GPS real + registra push token quando user loga
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let active = true;
    (async () => {
      try {
        const coords = await getCurrentLocation();
        if (!active || useAuthStore.getState().user?.id !== user.id) return;
        await api.put('/users/location', {
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        const current = useAuthStore.getState().user;
        if (active && current?.id === user.id) setUser({ ...current, latitude: coords.latitude, longitude: coords.longitude });
      } catch {
        // silencioso
      }
      // Push notifications — pede permissão e registra token
      try {
        if (!active) return;
        await registerForPushNotifications();
      } catch {
        // silencioso
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  if (isLoading) {
    return null; // Splash screen handled by expo-splash-screen
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !user?.onboardingCompleted ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainTabNavigator} />
        )}
      </Stack.Navigator>
      <NetworkBanner />
      <EmailVerificationBanner />
    </View>
  );
}
