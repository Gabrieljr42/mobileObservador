import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import { ConcursoUpdate } from '../api/updates';
import { UpdateTypeBadge, getUpdateTypeConfig } from './UpdateTypeBadge';

export function UpdateCard({ update, onPress }: { update: ConcursoUpdate, onPress: () => void }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const config = getUpdateTypeConfig(update.change_type);
  
  // Format date relative or localized
  const dateStr = new Date(update.captured_at).toLocaleDateString('pt-BR');

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <UpdateTypeBadge changeType={update.change_type} />
        <Text style={styles.date}>{dateStr}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{update.titulo}</Text>
      <View style={styles.metaRow}>
        {update.banca && <Text style={styles.metaText}>{update.banca}</Text>}
        {update.banca && update.cidade && <Text style={styles.metaDot}>•</Text>}
        {update.cidade && <Text style={styles.metaText}>{update.cidade}{update.uf ? ` - ${update.uf}` : ''}</Text>}
      </View>
      
      <View style={styles.summaryBox}>
        <MaterialIcons name={config.icon as any} size={16} color={theme.colors.primary} />
        <Text style={styles.summary} numberOfLines={2}>{update.change_summary}</Text>
      </View>
    </Pressable>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceLowest,
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.surfaceHighest,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  date: {
    fontSize: 12,
    color: theme.colors.mutedText,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaText: {
    fontSize: 12,
    color: theme.colors.mutedText,
  },
  metaDot: {
    fontSize: 12,
    color: theme.colors.mutedText,
    marginHorizontal: 4,
  },
  summaryBox: {
    backgroundColor: theme.colors.surfaceLow,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summary: {
    fontSize: 14,
    color: theme.colors.text,
    flex: 1,
  }
});
