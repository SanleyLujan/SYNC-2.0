import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { useThemeStore } from '../../store/themeStore';

export default function SupportTicketsScreen({ navigation }: any) {
  const theme = useThemeStore(state => state.theme);
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/feedback/support/tickets');
      setTickets(data || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <ScrollView style={[styles.container, loading && { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: 80 }}>
      <LinearGradient colors={['#15152E', '#0E0E1E', '#0A0A0F']} style={[styles.header, { paddingTop: Math.max(insets.top + 10, 48) }]}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Meus chamados</Text>
        <TouchableOpacity onPress={load} style={styles.backBtn}>
          <Ionicons name="refresh" size={18} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color={theme.primary} /></View>
      ) : tickets.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="file-tray-outline" size={42} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyText}>Você ainda não abriu chamados.</Text>
        </View>
      ) : tickets.map((ticket) => (
        <View key={ticket.id} style={styles.ticket}>
          <View style={styles.ticketTop}>
            <Text style={styles.protocol}>{ticket.protocol || ticket.id}</Text>
            <Text style={styles.status}>{ticket.status || 'new'}</Text>
          </View>
          <Text style={styles.message}>{ticket.message}</Text>
          <Text style={styles.date}>{new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: fontSize.xl, fontWeight: '900' },
  loading: { paddingTop: 120, alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 100, gap: spacing.sm },
  emptyText: { color: colors.dark.secondaryText, fontSize: 13 },
  ticket: { marginHorizontal: spacing.md, marginBottom: spacing.md, backgroundColor: 'rgba(255,255,255,0.055)', borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: spacing.md },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  protocol: { color: '#fff', fontSize: 13, fontWeight: '900' },
  status: { color: '#3B82F6', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  message: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  date: { color: 'rgba(255,255,255,0.42)', fontSize: 11, marginTop: spacing.sm },
});
