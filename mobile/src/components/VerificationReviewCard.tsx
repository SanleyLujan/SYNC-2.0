import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import api from '../services/api';
import { confirmAsync } from '../utils/confirm';
import { showToast } from './ui/Toast';

const documents = [['selfie', 'Selfie'], ['documentFront', 'Documento · frente'], ['documentBack', 'Documento · verso']] as const;
type Slot = typeof documents[number][0];

export default function VerificationReviewCard({ request, onReviewed, onRefresh }: { request: any; onReviewed: () => void; onRefresh: () => void }) {
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [seen, setSeen] = useState<Partial<Record<Slot, boolean>>>({});
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [expired, setExpired] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const urls = JSON.stringify(request.images);
  useEffect(() => {
    setExpired(false); setSeen({}); setSelected(null); setImageError(false);
    const timer = setTimeout(() => { setExpired(true); setSelected(null); setSeen({}); }, 290_000);
    return () => clearTimeout(timer);
  }, [urls]);
  const review = async (decision: 'approve' | 'reject') => {
    if (submitting.current || expired) return;
    if (decision === 'reject' && !reason.trim()) { showToast('Informe o motivo da recusa.', 'error'); return; }
    if (decision === 'approve' && !documents.every(([key]) => seen[key])) return;
    submitting.current = true; setBusy(true);
    try {
      if (!await confirmAsync(decision === 'approve' ? 'Aprovar identidade?' : 'Recusar pedido?', decision === 'approve'
        ? 'Você conferiu selfie, frente e verso e confirmou que pertencem à mesma pessoa? O perfil receberá o selo e as imagens serão apagadas.'
        : 'O motivo será exibido à pessoa e ela poderá enviar novas imagens. Os documentos deste pedido serão apagados.', { confirmText: decision === 'approve' ? 'Aprovar selo' : 'Recusar' })) return;
      await api.put(`/admin/verifications/${request.id}`, { decision, ...(decision === 'reject' ? { reason: reason.trim() } : {}) }, { timeout: 30_000 });
      setSelected(null); setSeen({});
      showToast(decision === 'approve' ? 'Perfil verificado. Selo aprovado.' : 'Pedido recusado com motivo.', 'success');
      onReviewed();
    } catch (error: any) {
      const message = error.response?.data?.message;
      showToast(typeof message === 'string' ? message : 'Não foi possível salvar a análise. Atualize a fila e confira o status.', 'error');
    } finally { submitting.current = false; setBusy(false); }
  };
  const canApprove = !busy && !expired && !imageError && !request.imageError && documents.every(([key]) => seen[key]);
  const button = { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#525269', alignItems: 'center' as const };
  return <View style={{ paddingVertical: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#343447' }}>
    <Text style={{ color: '#fff', fontWeight: '700' }}>{request.user?.name || 'Usuário'}</Text>
    <Text style={{ color: '#b8b8ca', fontSize: 12 }}>Enviado em {new Date(request.createdAt).toLocaleString('pt-BR')}</Text>
    <Text style={{ color: '#b8b8ca', fontSize: 12 }}>Abra e confira as três imagens antes de aprovar. Links privados expiram em 5 minutos.</Text>
    {(expired || request.imageError || imageError) && <Text accessibilityRole="alert" style={{ color: '#FCA5A5' }}>{expired ? 'As imagens expiraram. Atualize para continuar.' : request.imageError || 'Falha ao carregar uma imagem. Atualize os documentos.'}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {documents.map(([key, label]) => <TouchableOpacity key={key} accessibilityRole="button" accessibilityLabel={`Abrir ${label}`} disabled={busy || expired || !request.images?.[key]} onPress={() => { setSelected(key); setZoom(false); setImageLoading(true); }} style={{ flexGrow: 1, flexBasis: 100, gap: 6 }}>
        {!expired && request.images?.[key] && <Image source={{ uri: request.images[key] }} cachePolicy="none" contentFit="contain" style={{ width: '100%', height: 110, backgroundColor: '#171725' }} onError={() => setImageError(true)} />}
        <Text style={{ color: seen[key] ? '#86EFAC' : '#ddd', fontSize: 12 }}>{label}{seen[key] ? ' · conferida' : ''}</Text>
      </TouchableOpacity>)}
    </View>
    <TouchableOpacity disabled={busy} onPress={onRefresh} style={button}><Text style={{ color: '#b8d7ff' }}>Atualizar documentos</Text></TouchableOpacity>
    <TextInput accessibilityLabel="Motivo da recusa" placeholder="Motivo da recusa (obrigatório para recusar)" placeholderTextColor="#a5a5b8" value={reason} onChangeText={setReason} maxLength={300} multiline editable={!busy} style={{ color: '#fff', borderWidth: 1, borderColor: '#525269', borderRadius: 10, padding: 12, minHeight: 80 }} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TouchableOpacity disabled={busy || expired || !reason.trim()} onPress={() => void review('reject')} style={[button, { flex: 1, opacity: busy || expired || !reason.trim() ? 0.4 : 1 }]}><Text style={{ color: '#FCA5A5' }}>Recusar</Text></TouchableOpacity>
      <TouchableOpacity disabled={!canApprove} onPress={() => void review('approve')} style={[button, { flex: 1, opacity: canApprove ? 1 : 0.4 }]}><Text style={{ color: '#86EFAC' }}>Aprovar selo</Text></TouchableOpacity>
    </View>
    {busy && <ActivityIndicator accessibilityLabel="Salvando análise" />}
    <Modal visible={!!selected} onRequestClose={() => setSelected(null)} animationType="fade">
      <View style={{ flex: 1, backgroundColor: '#10101d', paddingTop: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setSelected(null)}><Text style={{ color: '#fff' }}>Fechar</Text></TouchableOpacity>
          <Text style={{ color: '#fff' }}>{documents.find(([key]) => key === selected)?.[1]}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => setZoom(!zoom)}><Text style={{ color: '#fff' }}>{zoom ? 'Reduzir' : 'Ampliar'}</Text></TouchableOpacity>
        </View>
        {imageLoading && <ActivityIndicator accessibilityLabel="Carregando documento" />}
        <ScrollView><ScrollView horizontal>
          {selected && !expired && <Image key={request.images?.[selected]} source={{ uri: request.images?.[selected] }} cachePolicy="none" contentFit="contain" style={{ width: width * (zoom ? 2 : 1), height: (height - 140) * (zoom ? 2 : 1) }} onLoad={() => { setImageLoading(false); setSeen(current => ({ ...current, [selected]: true })); }} onError={() => { setImageLoading(false); setImageError(true); setSeen(current => ({ ...current, [selected]: false })); }} />}
        </ScrollView></ScrollView>
        {imageError && <Text style={{ color: '#FCA5A5', padding: 16 }}>Não foi possível carregar. Feche e atualize os documentos.</Text>}
      </View>
    </Modal>
  </View>;
}
