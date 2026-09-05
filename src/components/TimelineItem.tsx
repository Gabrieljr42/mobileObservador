import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import { ConcursoVersion } from '../api/updates';
import { getUpdateTypeConfig } from './UpdateTypeBadge';
import { formatDate, formatDatesInText } from '../utils/formatters';

export function TimelineItem({ version, isLast }: { version: ConcursoVersion, isLast: boolean }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const config = getUpdateTypeConfig(version.change_type);
  
  const dateStr = formatDate(version.captured_at);
  const summary = version.change_summary
    ? formatDatesInText(version.change_summary)
    : version.change_type === 'created'
      ? 'Concurso cadastrado pela primeira vez.'
      : 'Alteração registrada.';

  return (
    <View style={styles.container}>
      <View style={styles.timelineCol}>
        <View style={[styles.dot, { backgroundColor: config.color }]} />
        {!isLast && <View style={[styles.line, { backgroundColor: theme.colors.surfaceHighest }]} />}
      </View>
      <View style={styles.contentCol}>
        <Text style={styles.date}>{dateStr}</Text>
        <View style={styles.card}>
          <View style={styles.header}>
            <MaterialIcons name={config.icon as any} size={16} color={config.color} />
            <Text style={[styles.type, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.summary}>{summary}</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  timelineCol: {
    width: 24,
    alignItems: 'center',
    marginRight: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
  },
  contentCol: {
    flex: 1,
    paddingBottom: 24,
  },
  date: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.mutedText,
    marginBottom: 8,
  },
  card: {
    backgroundColor: theme.colors.surfaceLowest,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.surfaceHighest,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  type: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  summary: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  }
});
