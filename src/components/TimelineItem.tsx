import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import { ConcursoVersion } from '../api/updates';
import { getUpdateTypeConfig } from './UpdateTypeBadge';
import { formatDate, formatDatesInText, formatChangedValue } from '../utils/formatters';

const changedFieldLabels: Record<string, string> = {
  etapas_prova: 'Etapas da prova',
  resultado_final_prazo: 'Prazo do resultado final',
  entrega_titulos_prazo: 'Prazo da entrega de títulos',
  inscricao_inicio: 'Início das inscrições',
  inscricao_fim: 'Fim das inscrições',
  prova_data: 'Data da prova',
  cargos: 'Cargos e condições',
  vagas: 'Quantidade de seleções',
  salario_min: 'Remuneração mínima',
  salario_max: 'Remuneração máxima',
  taxa: 'Taxa de inscrição',
  link_edital: 'Link do edital',
  edital_pdf_text_hash: 'Conteúdo do edital',
  content_hash: 'Conteúdo publicado',
};

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
          {version.changed_fields && Object.entries(version.changed_fields).map(([field, raw]) => {
            const change = raw && typeof raw === 'object' ? raw as { old?: unknown; new?: unknown; previous?: unknown; reason?: string } : { new: raw };
            const oldValue = 'old' in change ? change.old : change.previous;
            return <View key={field} style={styles.changeRow}>
              <Text style={styles.changeLabel}>{changedFieldLabels[field] ?? field}</Text>
              <Text style={styles.changeValue}>{formatChangedValue(oldValue)} → {formatChangedValue(change.new)}</Text>
              {!!change.reason && <Text style={styles.changeReason}>{change.reason}</Text>}
            </View>;
          })}
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
  },
  changeRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.surfaceHighest },
  changeLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.primary, marginBottom: 3 },
  changeValue: { fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  changeReason: { fontSize: 12, color: theme.colors.mutedText, lineHeight: 17, marginTop: 3 },
});
