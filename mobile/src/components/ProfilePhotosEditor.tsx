import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { profileGallery, replaceGalleryPhoto, resizeGalleryPhoto } from '../utils/profile-photos';
import api from '../services/api';
import { showToast } from './ui/Toast';

export default function ProfilePhotosEditor({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const user = useAuthStore(s => s.user);
  const theme = useThemeStore(s => s.theme);
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => { if (visible && user) setPhotos(profileGallery(user)); }, [visible, user?.id]);
  const pick = async (index: number | null) => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      if (Platform.OS !== 'web' && !(await ImagePicker.requestMediaLibraryPermissionsAsync()).granted) throw new Error('Permita acesso às fotos para continuar.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.4, base64: true, allowsEditing: true });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const photo = Platform.OS === 'web' ? await resizeGalleryPhoto(asset.uri) : asset.base64 ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` : '';
      if (!photo || photo.length > 550000) throw new Error('Escolha uma foto menor ou recorte a imagem antes de salvar (máximo de aproximadamente 400 KB).');
      setPhotos(current => replaceGalleryPhoto(current, index, photo));
    } catch (e: any) { showToast(e.message || 'Não foi possível preparar a foto.', 'error'); }
    finally { locked.current = false; setBusy(false); }
  };
  const save = async () => {
    if (locked.current || photos.length < 3) return;
    locked.current = true; setBusy(true);
    const owner = user?.id;
    try {
      const { data } = await api.post('/users/me/photos', { photos }, { timeout: 30_000 });
      if (owner === useAuthStore.getState().user?.id) useAuthStore.getState().setUser(data);
      showToast('Fotos do perfil atualizadas.', 'success'); onClose();
    } catch (e: any) { const message = e.response?.data?.message; showToast(Array.isArray(message) ? message.join(' • ') : message || 'Não foi possível salvar as fotos.', 'error'); }
    finally { locked.current = false; setBusy(false); }
  };
  const button = { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center' as const };
  return <Modal visible={visible} onRequestClose={() => { if (!busy) onClose(); }} animationType="slide">
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 60, gap: 16 }}>
      <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: '700' }}>Fotos do perfil</Text>
      <Text style={{ color: theme.textSecondary }}>Estas fotos aparecem no Descobrir e no seu perfil. Mantenha de 3 a 5 fotos. A primeira abre a galeria; sua foto principal e capa continuam separadas.</Text>
      {photos.map((uri, i) => <View key={i} style={{ gap: 8 }}>
        <Image source={{ uri }} contentFit="contain" style={{ width: '100%', height: 220, borderRadius: 12, backgroundColor: theme.surface }} />
        <Text style={{ color: theme.textPrimary }}>Foto {i+1}{i === 0 ? ' · primeira no Descobrir' : ''}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TouchableOpacity disabled={busy} style={button} onPress={() => void pick(i)}><Text style={{ color: theme.primary }}>Trocar</Text></TouchableOpacity>
          <TouchableOpacity disabled={busy} style={button} onPress={() => setPhotos(current => current.filter((_, j) => j !== i))}><Text style={{ color: theme.textPrimary }}>Remover</Text></TouchableOpacity>
          {i > 0 && <TouchableOpacity disabled={busy} style={button} onPress={() => setPhotos(current => [current[i], ...current.filter((_, j) => j !== i)])}><Text style={{ color: theme.primary }}>Colocar primeiro</Text></TouchableOpacity>}
        </View>
      </View>)}
      {photos.length < 5 && <TouchableOpacity disabled={busy} style={button} onPress={() => void pick(null)}><Text style={{ color: theme.primary }}>Adicionar foto</Text></TouchableOpacity>}
      {photos.length < 3 && <Text style={{ color: theme.textSecondary }}>Adicione mais {3-photos.length} foto(s) para salvar.</Text>}
      {busy && <ActivityIndicator color={theme.primary} />}
      <TouchableOpacity disabled={busy || photos.length < 3} style={[button, { backgroundColor: theme.primary, opacity: busy || photos.length < 3 ? 0.5 : 1 }]} onPress={() => void save()}><Text style={{ color: '#fff', fontWeight: '700' }}>Salvar fotos</Text></TouchableOpacity>
      <TouchableOpacity disabled={busy} style={button} onPress={onClose}><Text style={{ color: theme.textPrimary }}>Cancelar</Text></TouchableOpacity>
    </ScrollView>
  </Modal>;
}
