import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { SvgXml } from 'react-native-svg';
import type { Activity } from '../types';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { buildWorkoutImage, projectWorkoutRoute, type WorkoutImageBackground } from '../utils/workout-image';
import { exportWorkoutImage } from '../utils/export-workout-image';
import { showToast } from './ui/Toast';

export default function WorkoutImageModal({ visible, activity, onClose }: { visible: boolean; activity: Activity; onClose: () => void }) {
  const theme = useThemeStore((s) => s.theme);
  const name = useAuthStore((s) => s.user?.name);
  const [background, setBackground] = useState<WorkoutImageBackground>('dark');
  const [includeRoute, setIncludeRoute] = useState(true);
  const [exporting, setExporting] = useState(false);
  const svgRef = useRef<Svg>(null);
  const { width } = useWindowDimensions();
  const previewWidth = Math.max(120, Math.min(width - 88, 320));
  const hasRoute = useMemo(() => !!projectWorkoutRoute(activity.points), [activity.points]);
  const xml = useMemo(() => buildWorkoutImage(activity, { background, includeRoute, name }), [activity, background, includeRoute, name]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportWorkoutImage(svgRef.current, xml, `sync-treino-${activity.id.replace(/[^a-zA-Z0-9_-]/g, '')}-${background}.png`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao exportar imagem', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!exporting) onClose(); }}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Imagem do treino</Text>
            <Text style={{ color: theme.textSecondary }}>Escolha o fundo do seu cartão PNG.</Text>
            <View style={styles.options}>
              {([['dark', 'Escuro'], ['light', 'Claro'], ['transparent', 'Transparente']] as const).map(([value, label]) => (
                <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: background === value, disabled: exporting }} disabled={exporting} onPress={() => setBackground(value)} style={[styles.option, { borderColor: background === value ? theme.primary : theme.border, backgroundColor: background === value ? theme.primarySoft : theme.surface }]}>
                  <Text style={{ color: theme.textPrimary, fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.routeOption}>
              <Text style={{ color: theme.textPrimary }}>{hasRoute ? 'Incluir traçado GPS' : 'Treino sem rota GPS'}</Text>
              <Switch accessibilityLabel="Incluir traçado GPS na imagem" value={includeRoute && hasRoute} disabled={!hasRoute || exporting} onValueChange={setIncludeRoute} trackColor={{ true: theme.primary }} />
            </View>
            <View style={[styles.preview, { width: previewWidth, height: previewWidth * 1.25 }]}>
              <SvgXml xml={xml} override={{ ref: svgRef, width: previewWidth, height: previewWidth * 1.25, viewBox: '0 0 1080 1350' }} />
            </View>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {background === 'transparent' ? 'O cinza aparece só na prévia. O PNG terá fundo transparente para sobrepor em outra foto em um editor de imagens.' : 'PNG em 1080 × 1350, pronto para compartilhar.'}
              {hasRoute && includeRoute ? '\nO percurso é o traçado GPS, sem ruas ou mapa de fundo.' : ''}
            </Text>
            <TouchableOpacity accessibilityRole="button" disabled={exporting} onPress={handleExport} style={[styles.button, { backgroundColor: theme.primary, opacity: exporting ? 0.6 : 1 }]}>
              {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Exportar PNG</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" disabled={exporting} onPress={onClose} style={styles.close}>
              <Text style={{ color: theme.textSecondary }}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, maxHeight: '90%', borderRadius: 20, overflow: 'hidden' },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: '800' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 10 },
  routeOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  preview: { alignSelf: 'center', backgroundColor: '#64748B' },
  hint: { fontSize: 12, lineHeight: 18 },
  button: { padding: 15, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  close: { padding: 10, alignItems: 'center' },
});
