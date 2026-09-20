import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function VerifiedBadge() {
  return <View accessibilityLabel="Identidade verificada por análise de documentos" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: '#2E7BFF18' }}>
    <Ionicons name="checkmark-circle" size={18} color="#2E7BFF" />
    <Text style={{ color: '#2E7BFF', fontSize: 11, fontWeight: '700' }}>Verificado</Text>
  </View>;
}
