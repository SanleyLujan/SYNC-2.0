import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Avatar from '../../components/ui/Avatar';
import api from '../../services/api';
import { matchingApi } from '../../services/matching.service';
import { showToast } from '../../components/ui/Toast';
import { colors, fontSize, spacing, borderRadius } from '../../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface SearchUser {
  id: string;
  name: string;
  avatarUrl?: string;
  city?: string;
  sports?: string[];
  level?: string;
  matchStatus?: 'matched' | 'pending' | 'available';
}

export default function UserSearchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setError(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    setError(false);
    try {
      const { data } = await api.get('/users/search', { params: { q: q.trim() } });
      setResults(Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : []);
    } catch {
      setResults([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(text), 400);
  };

  const addUser = async (item: SearchUser) => {
    if (item.matchStatus === 'matched' || connectingId) return;
    setConnectingId(item.id);
    try {
      const result = await matchingApi.swipe(item.id, 'like');
      setResults((prev) => prev.map((user) => (
        user.id === item.id
          ? { ...user, matchStatus: result.matched ? 'matched' : 'pending' }
          : user
      )));
      showToast(
        result.matched
          ? `Match com ${item.name}! 🎉`
          : result.alreadyLiked
            ? 'Convite já enviado. Aguardando resposta.'
            : 'Convite enviado. O conteúdo aparece quando houver match.',
        'success',
      );
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Não foi possível enviar o convite.', 'error');
    } finally {
      setConnectingId(null);
    }
  };

  const renderItem = ({ item }: { item: SearchUser }) => (
    <View style={styles.userRow}>
      <TouchableOpacity
        style={styles.userMain}
        onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
        activeOpacity={0.7}
      >
        <Avatar uri={item.avatarUrl} size={48} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={colors.dark.secondaryText} />
              <Text style={styles.metaText}>{item.city}</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.dark.secondaryText} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.addBtn, item.matchStatus === 'matched' && styles.addBtnMatched, item.matchStatus === 'pending' && styles.addBtnPending]}
        onPress={() => addUser(item)}
        disabled={item.matchStatus !== 'available' || connectingId !== null}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.matchStatus === 'matched' ? `Match com ${item.name}` : item.matchStatus === 'pending' ? `Convite enviado para ${item.name}` : `Adicionar ${item.name}`}
      >
        {connectingId === item.id ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name={item.matchStatus === 'matched' ? 'checkmark' : item.matchStatus === 'pending' ? 'time-outline' : 'person-add-outline'} size={15} color="#fff" />
            <Text style={styles.addBtnText}>{item.matchStatus === 'matched' ? 'Match' : item.matchStatus === 'pending' ? 'Enviado' : 'Adicionar'}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#15152E', '#0E0E1E', '#0A0A0F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top + 10, 48) }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={colors.dark.text} />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.dark.secondaryText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nome ou ID do atleta..."
            placeholderTextColor={colors.dark.secondaryText}
            value={query}
            onChangeText={handleChangeText}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => search(query)}
            maxLength={60}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={colors.dark.secondaryText} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            loading ? null : error ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={48} color={colors.primary + '40'} />
                <Text style={styles.emptyText}>Erro na busca</Text>
                <Text style={styles.emptyHint}>Verifique sua conexão e tente de novo.</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => search(query)}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                >
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            ) : searched ? (
              <View style={styles.empty}>
                <Ionicons name="person-outline" size={48} color={colors.primary + '40'} />
                <Text style={styles.emptyText}>Nenhum atleta encontrado</Text>
                <Text style={styles.emptyHint}>Tente outro nome ou ID</Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={48} color={colors.primary + '30'} />
                <Text style={styles.emptyText}>Busque por nome ou ID</Text>
                <Text style={styles.emptyHint}>Adicione atletas para criar um match</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // paddingTop dinâmico via insets no JSX (notch/safe-area)
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.20)',
  },
  searchInput: {
    flex: 1,
    color: colors.dark.text,
    fontSize: fontSize.md,
    padding: 0,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: spacing.md,
  },
  userMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: fontSize.md, fontWeight: '700', color: colors.dark.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: fontSize.xs, color: colors.dark.secondaryText },
  addBtn: {
    minWidth: 88,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addBtnMatched: { backgroundColor: '#10B981' },
  addBtnPending: { backgroundColor: '#64748B' },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 80, gap: spacing.sm },
  emptyText: { color: colors.dark.text, fontSize: fontSize.md, fontWeight: '600' },
  emptyHint: { color: colors.dark.secondaryText, fontSize: fontSize.sm },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FF6B35',
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
});
