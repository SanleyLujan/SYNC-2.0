import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { profileGallery } from '../utils/profile-photos';
import { useThemeStore } from '../store/themeStore';

export default function ProfilePhotoGallery({ user }: { user: { id: string; profilePhotos?: string[] | null; avatarUrl?: string | null } }) {
  const photos = profileGallery(user);
  const theme = useThemeStore(s => s.theme);
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => setIndex(null), [user.id, user.profilePhotos]);
  if (!photos.length) return null;
  return <View style={{ gap: 10, marginVertical: 16 }}>
    <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '700' }}>Fotos do perfil</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
      {photos.map((uri, i) => <TouchableOpacity key={i} accessibilityRole="button" accessibilityLabel={`Abrir foto ${i+1} de ${photos.length}`} onPress={() => setIndex(i)}>
        <Image source={{ uri }} contentFit="cover" style={{ width: 112, height: 150, borderRadius: 12 }} />
      </TouchableOpacity>)}
    </ScrollView>
    <Modal visible={index !== null} onRequestClose={() => setIndex(null)} animationType="fade">
      <View style={{ flex: 1, backgroundColor: '#090e18', paddingTop: 48, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20 }}>
          <Text style={{ color: '#fff' }}>Foto {(index ?? 0)+1} de {photos.length}</Text>
          <TouchableOpacity onPress={() => setIndex(null)} accessibilityRole="button"><Text style={{ color: '#fff' }}>Fechar</Text></TouchableOpacity>
        </View>
        {index !== null && <Image source={{ uri: photos[index] }} contentFit="contain" style={{ flex: 1 }} />}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 20 }}>
          <TouchableOpacity disabled={!index} onPress={() => setIndex(i => Math.max(0, (i ?? 0)-1))}><Text style={{ color: index ? '#fff' : '#666' }}>Anterior</Text></TouchableOpacity>
          <TouchableOpacity disabled={index === photos.length-1} onPress={() => setIndex(i => Math.min(photos.length-1, (i ?? 0)+1))}><Text style={{ color: index === photos.length-1 ? '#666' : '#fff' }}>Próxima</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}
