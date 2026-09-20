import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { showToast } from '../../components/ui/Toast';
import { useThemeStore } from '../../store/themeStore';
import { borderRadius, fontSize, spacing } from '../../theme';

type Slot = 'selfie' | 'documentFront' | 'documentBack';
type Asset = ImagePicker.ImagePickerAsset;

const COPY: Record<Slot, { title: string; hint: string; icon: keyof typeof Ionicons.glyphMap }> = {
  selfie: { title: 'Selfie atual', hint: 'Rosto visível, sem filtro e com boa luz', icon: 'person-outline' },
  documentFront: { title: 'Documento · frente', hint: 'Foto nítida e sem reflexos', icon: 'card-outline' },
  documentBack: { title: 'Documento · verso', hint: 'Mostre o documento inteiro', icon: 'card-outline' },
};

export default function ProfileVerificationScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((s) => s.theme);
  const [assets, setAssets] = useState<Partial<Record<Slot, Asset>>>({});
  const [status, setStatus] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const focused = useRef(false);
  const sendingRef = useRef(false);

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setStatusError(false);
    const userId = useAuthStore.getState().user?.id;
    try {
      const { data } = await api.get('/verification/status');
      if (!focused.current || userId !== useAuthStore.getState().user?.id) return;
      setStatus(data);
      const current = useAuthStore.getState().user;
      if (current && typeof data.isVerified === 'boolean' && current.isVerified !== data.isVerified) {
        useAuthStore.getState().setUser({ ...current, isVerified: data.isVerified });
      }
    }
    catch { if (focused.current) { setStatus(null); setStatusError(true); } }
    finally { if (focused.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void loadStatus();
    const timer = setInterval(() => { if (!sendingRef.current) void loadStatus(true); }, 30_000);
    return () => { focused.current = false; clearInterval(timer); };
  }, [loadStatus]));

  const pick = async (slot: Slot) => {
    if (sendingRef.current) return;
    try {
    const permission = Platform.OS === 'web' ? { granted: true } : slot === 'selfie'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Permita o acesso à câmera ou às fotos para continuar.', 'error');
      return;
    }
    const result = slot === 'selfie' && Platform.OS !== 'web'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if ((asset.fileSize || asset.file?.size || 0) > 6 * 1024 * 1024) { showToast('Cada imagem deve ter no máximo 6 MB.', 'error'); return; }
      if (asset.mimeType && !/^image\/(jpeg|png|webp)$/i.test(asset.mimeType)) { showToast('Use uma imagem JPEG, PNG ou WebP.', 'error'); return; }
      setAssets((current) => ({ ...current, [slot]: asset }));
    }
    } catch { showToast('Não foi possível abrir a câmera ou selecionar a imagem.', 'error'); }
  };

  const appendAsset = async (form: FormData, slot: Slot, asset: Asset) => {
    if (Platform.OS === 'web') {
      const blob = asset.file || await (await fetch(asset.uri)).blob();
      form.append(slot, blob, asset.fileName || `${slot}.jpg`);
      return;
    }
    form.append(slot, {
      uri: asset.uri,
      name: `${slot}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    } as any);
  };

  const submit = async () => {
    if (sendingRef.current || loading || status?.canSubmit !== true) return;
    if (!assets.selfie || !assets.documentFront || !assets.documentBack) {
      showToast('Adicione as três imagens antes de enviar.', 'error');
      return;
    }
    setSending(true);
    sendingRef.current = true;
    try {
      const form = new FormData();
      await appendAsset(form, 'selfie', assets.selfie);
      await appendAsset(form, 'documentFront', assets.documentFront);
      await appendAsset(form, 'documentBack', assets.documentBack);
      await api.post('/verification/requests', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 });
      setAssets({});
      setStatus({ status: 'pending', canSubmit: false });
      await loadStatus();
      showToast('Pedido enviado para análise.', 'success');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Não foi possível enviar o pedido.';
      showToast(Array.isArray(message) ? message.join(' • ') : message, 'error');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const locked = loading || statusError || status?.canSubmit !== true || status?.status === 'pending' || status?.isVerified;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={theme.mode === 'dark' ? ['#071427', '#040B16', theme.background] : ['#FFFFFF', '#F9FAFC', theme.background]}
        style={[styles.header, { paddingTop: Math.max(insets.top + 10, 48) }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
          <Ionicons name="arrow-back" size={21} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Verificar perfil</Text>
        <TouchableOpacity accessibilityLabel="Atualizar status da verificação" disabled={loading || sending} onPress={() => void loadStatus()}><Ionicons name="refresh" size={22} color={theme.textPrimary} /></TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.info, { backgroundColor: theme.primarySoft, borderColor: theme.primary + '35' }]}>
          <Ionicons name={status?.isVerified ? 'checkmark-circle' : 'shield-checkmark-outline'} size={24} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>
              {loading ? 'Verificando disponibilidade…' : statusError ? 'Não foi possível consultar' : status?.isVerified ? 'Perfil verificado' : status?.status === 'pending' ? 'Em análise' : !status?.canSubmit ? 'Verificação indisponível no momento' : status?.status === 'rejected' ? 'Pedido não aprovado' : 'Análise manual e privada'}
            </Text>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {loading ? 'Aguarde antes de selecionar documentos.' : statusError ? 'Não foi possível consultar seu pedido. Toque em atualizar.' : (!status?.canSubmit && !status?.isVerified && status?.status !== 'pending') ? 'O recebimento de documentos está temporariamente indisponível. A administração precisa verificar o armazenamento privado.' : status?.isVerified
                ? 'Seu selo já aparece para outras pessoas.'
                : status?.status === 'pending'
                  ? 'Consulte o resultado nesta tela depois da revisão administrativa.'
                  : status?.rejectionReason || 'As imagens são acessíveis somente por administradores autorizados e são apagadas após a decisão.'}
            </Text>
          </View>
        </View>

        {!loading && (statusError || (!status?.canSubmit && !status?.isVerified && status?.status !== 'pending')) && (
          <TouchableOpacity onPress={() => void loadStatus()} accessibilityRole="button" style={styles.slot}>
            <Text style={{ color: theme.primary }}>Tentar novamente</Text>
          </TouchableOpacity>
        )}

        {!locked && (Object.keys(COPY) as Slot[]).map((slot) => {
          const asset = assets[slot];
          const copy = COPY[slot];
          return (
            <TouchableOpacity key={slot} disabled={sending} onPress={() => void pick(slot)} style={[styles.slot, { backgroundColor: theme.surface, borderColor: asset ? theme.primary : theme.border }]}>
              {asset ? <Image source={{ uri: asset.uri }} style={styles.preview} /> : (
                <View style={[styles.slotIcon, { backgroundColor: theme.primarySoft }]}><Ionicons name={copy.icon} size={24} color={theme.primary} /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.slotTitle, { color: theme.textPrimary }]}>{copy.title}</Text>
                <Text style={[styles.slotHint, { color: theme.textSecondary }]}>{asset ? 'Imagem adicionada · toque para trocar' : copy.hint}</Text>
              </View>
              <Ionicons name={asset ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={theme.primary} />
            </TouchableOpacity>
          );
        })}

        {!locked && (
          <TouchableOpacity disabled={sending} onPress={() => void submit()} style={[styles.submit, { backgroundColor: theme.primary, opacity: sending ? 0.65 : 1 }]}>
            {sending ? <ActivityIndicator color="#fff" /> : <><Ionicons name="shield-checkmark" size={19} color="#fff" /><Text style={styles.submitText}>Enviar para análise</Text></>}
          </TouchableOpacity>
        )}
        <Text style={[styles.privacy, { color: theme.textSecondary }]}>Não envie CPF por texto. O documento é processado sem EXIF/GPS, armazenado em bucket privado e não aparece no perfil.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.lg, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: 80 },
  info: { flexDirection: 'row', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.lg },
  infoTitle: { fontSize: 15, fontWeight: '800' },
  infoText: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm },
  slotIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  preview: { width: 48, height: 48, borderRadius: 12 },
  slotTitle: { fontSize: 14, fontWeight: '700' },
  slotHint: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  submit: { minHeight: 50, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.md },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  privacy: { fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: spacing.md },
});
