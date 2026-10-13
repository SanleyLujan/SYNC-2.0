import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/types';
import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore } from '../../store/authStore';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import ScreenContainer from '../../components/layout/ScreenContainer';
import ProgressBar from '../../components/ui/ProgressBar';
import Button from '../../components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { showToast } from '../../components/ui/Toast';
import { useThemeStore } from '../../store/themeStore';

type Props = {
  navigation: NativeStackNavigationProp<OnboardingStackParamList, 'Photos'>;
};

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;
const ACCENT = '#FF6B35';

/** Web-only: redimensiona imagem para 400×400 via canvas → data URL */
function resizeForWeb(uri: string, size = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject(new Error('no window')); return; }
    const img = new (window as any).Image() as HTMLImageElement;
    img.onload = () => {
      const canvas = (window as any).document.createElement('canvas') as HTMLCanvasElement;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const ox = (img.naturalWidth - side) / 2;
      const oy = (img.naturalHeight - side) / 2;
      ctx.drawImage(img, ox, oy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.55));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = uri;
  });
}

export default function PhotosScreen({ navigation }: Props) {
  const theme = useThemeStore(state => state.theme);
  const onboardingStore = useOnboardingStore();
  const setUser = useAuthStore((state) => state.setUser);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  const processAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) return;

    setUploading(true);
    // Mantém base64 no state (sem rede) — persistido só no final em handleFinish,
    // que tem fallback offline. Onboarding não pode travar por upload.
    const processed: string[] = [];
    for (const asset of assets.slice(0, remainingSlots)) {
      try {
        let base64: string;
        if (Platform.OS === 'web') {
          base64 = await resizeForWeb(asset.uri, 400);
        } else {
          const mime = asset.mimeType || 'image/jpeg';
          base64 = asset.base64 ? `data:${mime};base64,${asset.base64}` : asset.uri;
        }
        processed.push(base64);
      } catch {
        // pula uma foto que falhou em processar, mas mantém as outras
      }
    }

    if (processed.length > 0) {
      setPhotos((prev) => [...prev, ...processed].slice(0, MAX_PHOTOS));
    }
    setUploading(false);
  };

  const pickPhoto = async () => {
    setShowPhotoOptions(false);
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          showToast('Libere o acesso à galeria para adicionar fotos.', 'error');
          return;
        }
      }

      const remainingSlots = MAX_PHOTOS - photos.length;
      if (remainingSlots <= 0) return;

      // Seleção MÚLTIPLA: dá pra escolher várias fotos de uma vez (até preencher MAX_PHOTOS).
      // allowsEditing/aspect são ignorados quando allowsMultipleSelection=true — então
      // no web fazemos o crop quadrado via canvas (resizeForWeb).
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;
      await processAssets(result.assets);
    } catch (e: any) {
      showToast(e?.message || 'Não foi possível carregar as fotos', 'error');
    }
  };

  const takePhoto = async () => {
    setShowPhotoOptions(false);
    if (photos.length >= MAX_PHOTOS) return;

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast('Libere o acesso à câmera para tirar uma foto.', 'error');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;
      await processAssets(result.assets);
    } catch (e: any) {
      showToast(e?.message || 'Não foi possível abrir a câmera', 'error');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = async () => {
    if (photos.length < MIN_PHOTOS) {
      showToast(`Adicione pelo menos ${MIN_PHOTOS} fotos para continuar.`, 'error');
      return;
    }
    setSaving(true);
    try {
      // 1. Upload photos
      const { data: userWithPhotos } = await api.post('/users/me/photos', { photos });
      // 2. Complete onboarding with location/sports/etc data
      const onboardingData = onboardingStore.getData();
      const { data: updatedUser } = await api.post('/users/onboarding', onboardingData);
      setUser({ ...userWithPhotos, ...updatedUser });
      onboardingStore.reset();
    } catch (err: any) {
      const msg = err.response?.data?.message;
      showToast(
        Array.isArray(msg)
          ? msg.join(' • ')
          : msg || 'Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.',
        'error',
      );
      setSaving(false);
    }
  };

  const canContinue = photos.length >= MIN_PHOTOS;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <ProgressBar current={7} total={7} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.title}>Suas fotos</Text>
        <Text style={styles.subtitle}>
          Adicione pelo menos {MIN_PHOTOS} fotos (você pode selecionar várias de uma vez) para que outros atletas possam te conhecer melhor
        </Text>

        {/* Progress indicator */}
        <View style={styles.progressRow}>
          {[...Array(MIN_PHOTOS)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                { backgroundColor: i < photos.length ? ACCENT : 'rgba(255,255,255,0.15)' },
              ]}
            />
          ))}
          <Text style={styles.progressText}>
            {photos.length}/{MIN_PHOTOS} mínimo
            {photos.length >= MIN_PHOTOS ? ' ✓' : ''}
          </Text>
        </View>

        {/* Photo grid */}
        <View style={styles.grid}>
          {photos.map((uri, index) => (
            <View key={index} style={styles.photoCell}>
              <Image source={{ uri }} style={styles.photo} />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removePhoto(index)}
                hitSlop={6}
              >
                <View style={styles.removeBtnInner}>
                  <Ionicons name="close" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              {index === 0 && (
                <View style={styles.mainBadge}>
                  <Text style={styles.mainBadgeText}>Principal</Text>
                </View>
              )}
            </View>
          ))}

          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity
              style={[styles.photoCell, styles.addCell]}
              onPress={() => setShowPhotoOptions(true)}
              disabled={uploading}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={photos.length === 0 ? 'Adicionar fotos' : 'Adicionar mais fotos'}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <LinearGradient
                    colors={[ACCENT + '22', ACCENT + '08']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.addIcon}>
                    <Ionicons name="add" size={28} color={ACCENT} />
                  </View>
                  <Text style={styles.addLabel}>
                    {photos.length === 0 ? 'Adicionar fotos' : 'Mais fotos'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Tips */}
        <View style={styles.tipsBox}>
          <Text style={styles.tipsTitle}>💡 Dicas para boas fotos</Text>
          {[
            'Use fotos recentes e nítidas',
            'Inclua uma foto praticando esporte',
            'Sorria — perfis com sorriso têm 3× mais matches',
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowPhotoOptions(false)}
        >
          <View style={styles.photoOptionsSheet}>
            <Text style={styles.photoOptionsTitle}>Adicionar foto</Text>
            <Text style={styles.photoOptionsSubtitle}>Escolha de onde deseja adicionar sua foto</Text>

            <TouchableOpacity
              style={styles.photoOption}
              onPress={takePhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Tirar foto com a câmera"
            >
              <View style={styles.photoOptionIcon}>
                <Ionicons name="camera" size={22} color={ACCENT} />
              </View>
              <View style={styles.photoOptionTextWrap}>
                <Text style={styles.photoOptionTitle}>Tirar foto</Text>
                <Text style={styles.photoOptionDescription}>Abrir a câmera agora</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoOption}
              onPress={pickPhoto}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Escolher fotos da galeria"
            >
              <View style={styles.photoOptionIcon}>
                <Ionicons name="images" size={22} color={ACCENT} />
              </View>
              <View style={styles.photoOptionTextWrap}>
                <Text style={styles.photoOptionTitle}>Escolher da galeria</Text>
                <Text style={styles.photoOptionDescription}>Selecionar uma ou mais fotos</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelOption}
              onPress={() => setShowPhotoOptions(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
            >
              <Text style={styles.cancelOptionText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Button
        title={saving ? 'Criando perfil…' : canContinue ? 'Entrar no Sync 🎉' : `Faltam ${MIN_PHOTOS - photos.length} foto${MIN_PHOTOS - photos.length !== 1 ? 's' : ''}`}
        onPress={handleFinish}
        disabled={!canContinue || saving}
        loading={saving}
        style={styles.button}
      />
    </ScreenContainer>
  );
}

const CELL = 160;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
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
  scroll: {
    flex: 1,
    marginTop: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.secondaryText,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressText: {
    fontSize: fontSize.sm,
    color: colors.secondaryText,
    marginLeft: 4,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  photoCell: {
    width: CELL,
    height: CELL,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  removeBtnInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: ACCENT,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  mainBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  addCell: {
    backgroundColor: 'rgba(255,107,53,0.07)',
    borderWidth: 2,
    borderColor: ACCENT + '55',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontSize: fontSize.sm,
    color: ACCENT,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  photoOptionsSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  photoOptionsTitle: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  photoOptionsSubtitle: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  photoOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT + '20',
  },
  photoOptionTextWrap: {
    flex: 1,
    marginLeft: spacing.md,
  },
  photoOptionTitle: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  photoOptionDescription: {
    color: colors.secondaryText,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  cancelOption: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  cancelOptionText: {
    color: colors.secondaryText,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  tipsBox: {
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: spacing.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  tipsTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.secondaryText,
    lineHeight: 18,
  },
  button: {
    marginBottom: spacing.lg,
  },
});
