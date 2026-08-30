import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

export function getUpdateTypeConfig(changeType: string) {
  switch (changeType) {
    case 'created': return { label: 'Novo concurso', icon: 'radar', color: '#ffb45a' }; // amber
    case 'document_added': return { label: 'Nova publicação', icon: 'notifications', color: '#ffb45a' };
    case 'edital_changed': return { label: 'Edital atualizado', icon: 'fact-check', color: '#a2cecf' }; // blue/amber
    case 'dates_changed': return { label: 'Prazo alterado', icon: 'calendar-today', color: '#ff970f' }; // orange
    case 'status_changed': return { label: 'Status alterado', icon: 'refresh', color: '#a2cecf' }; // blue
    case 'values_changed': return { label: 'Dados atualizados', icon: 'edit', color: '#a0a4a4' }; // gray/teal
    case 'vacancies_changed': return { label: 'Vagas atualizadas', icon: 'people', color: '#88dbd1' }; // green
    case 'updated': return { label: 'Atualização', icon: 'refresh', color: '#88dbd1' }; // teal
    default: return { label: 'Atualização', icon: 'update', color: '#a0a4a4' };
  }
}

export function UpdateTypeBadge({ changeType }: { changeType: string }) {
  const theme = useAppTheme();
  const config = getUpdateTypeConfig(changeType);
  
  return (
    <View style={[styles.badge, { backgroundColor: theme.colors.surfaceLow, borderColor: config.color }]}>
      <MaterialIcons name={config.icon as any} size={12} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
});
