import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { useOnboardingStore } from '../../store/onboardingStore';
import { colors, fontSize, spacing } from '../../theme';
import ScreenContainer from '../../components/layout/ScreenContainer';
import ProgressBar from '../../components/ui/ProgressBar';
import Chip from '../../components/ui/Chip';
import Button from '../../components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Hobbies'>;
};

const HOBBIES = [
  'Trilhas',
  'Café',
  'Música',
  'Viagens',
  'Fotografia',
  'Praia',
  'Games',
  'Leitura',
  'Culinária',
  'Yoga',
  'Voluntariado',
  'Pets',
];

export default function HobbiesScreen({ navigation }: Props) {
  const { hobbies, setHobbies } = useOnboardingStore();

  const toggle = (hobby: string) => {
    setHobbies(
      hobbies.includes(hobby)
        ? hobbies.filter((item) => item !== hobby)
        : [...hobbies, hobby].slice(0, 12),
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <ProgressBar current={4} total={7} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>O que você gosta de fazer?</Text>
        <Text style={styles.subtitle}>Escolha alguns interesses para deixar seu perfil mais completo</Text>

        <View style={styles.grid}>
          {HOBBIES.map((hobby) => (
            <Chip
              key={hobby}
              label={hobby}
              selected={hobbies.includes(hobby)}
              onPress={() => toggle(hobby)}
            />
          ))}
        </View>
      </View>

      <Button
        title="Continuar"
        onPress={() => navigation.navigate('Availability')}
        style={styles.button}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { flex: 1, marginTop: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.secondaryText,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  button: { marginBottom: spacing.lg },
});
