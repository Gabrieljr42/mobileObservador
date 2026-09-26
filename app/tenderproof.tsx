import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme } from '../src/theme';
import { resumoCargo } from '../src/utils/cargos';
import { extractionPendingReason } from '../src/utils/extractionPending';
import { registrationListsText } from '../src/utils/registrationLists';
import { ContinuousReview, PublicationReview } from '../src/components/TenderProofReview';
import { RecollectionReview } from '../src/components/RecollectionReview';
import {
  startTenderProofRun,
  getTenderProofRun,
  selectTenderProofCandidate,
  refreshTenderProofReplay,
  reconcileTenderProofSessions,
  fetchTenderProofPdfBytes,
  TenderProofMode,
  TenderProofRun,
  TenderProofComparisonField,
  TenderProofReplayStatus,
  getTenderProofCatalogue, ContinuousCatalogueSource,
} from '../src/api/tenderproof';

const FIELD_LABELS: Record<string, string> = {
  titulo: 'Título',
  orgao: 'Órgão',
  edital_numero: 'Número do edital',
  inscricao_inicio: 'Início das inscrições',
  inscricao_fim: 'Fim das inscrições',
  prova_data: 'Data da prova',
  remuneracao: 'Remuneração',
  cargos: 'Vagas, remuneração e requisitos por cargo',
  taxas_inscricao: 'Taxas de inscrição por escolaridade',
  inscricao_listas: 'Períodos de inscrição por lista',
};

const AGREEMENT_LABEL: Record<TenderProofComparisonField['agreement'], string> = {
  agree: 'Concordância',
  diverge: 'Divergência',
  no_evidence: 'Sem evidência',
  no_baseline: 'Sem baseline',
};

const AGREEMENT_COLOR: Record<TenderProofComparisonField['agreement'], string> = {
  agree: '#1a7f37',
  diverge: '#b42318',
  no_evidence: '#8a6d00',
  no_baseline: '#666666',
};

const REPLAY_LABEL: Record<TenderProofReplayStatus, string> = {
  available: 'Replay disponível',
  pending: 'Replay pendente',
  disabled: 'Replay desativado',
  failed: 'Replay falhou',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const lists = registrationListsText(value);
  if (lists !== null) return lists;
  if (Array.isArray(value) && value.every(c => c && typeof c.nome === 'string' && typeof c.remuneracao === 'string')) return value.map(resumoCargo).join('\n\n');
  if (typeof value === 'object') {
    const v = value as { valores_observados?: string[]; escopo?: string; nota?: string };
    if (Array.isArray(v.valores_observados)) {
      return `R$ ${v.valores_observados.join(', ')} (${v.escopo ?? 'escopo no contexto'})`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function shortSession(id: string | null): string {
  if (!id) return '—';
  return id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id;
}

// TenderProof: revisão por campo e publicação explicitamente autorizada no servidor.
export default function TenderProofScreen() {
  const { runId } = useLocalSearchParams<{ runId?: string }>();
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const [mode, setMode] = useState<TenderProofMode>('mock');
  const [source, setSource] = useState('ibgp_open');
  const [sources, setSources] = useState<ContinuousCatalogueSource[]>([]);
  useEffect(() => { getTenderProofCatalogue().then(setSources).catch(() => {}); }, []);
  const [run, setRun] = useState<TenderProofRun | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingNote, setLoadingNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfCheck, setPdfCheck] = useState<string | null>(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  useEffect(() => () => {
    if (pdfDownloadUrl) URL.revokeObjectURL(pdfDownloadUrl);
  }, [pdfDownloadUrl]);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setLoading(true);
    getTenderProofRun(runId)
      .then((saved) => { if (!cancelled) { setRun(saved); setMode(saved.mode); setPdfCheck(null); setPdfDownloadUrl(null); } })
      .catch(() => { if (!cancelled) setError('Execução indisponível para este usuário.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId]);

  const failMessage = (e: any, fallback: string) => {
    const status = e?.response?.status;
    const detail = e?.response?.data?.detail;
    if (e?.code === 'ECONNABORTED') {
      return 'Tempo esgotado aguardando o servidor. Consulte o andamento antes de repetir (a execução pode continuar no servidor).';
    }
    return `${status ? `HTTP ${status} — ` : ''}${detail ?? e?.message ?? fallback}`;
  };

  const handleStart = async () => {
    setLoading(true);
    setLoadingNote(mode === 'real' ? 'Consulta à fonte oficial em andamento (pode levar minutos)…' : null);
    setError(null);
    setPdfCheck(null);
    try {
      const started = await startTenderProofRun(mode, source);
      setRun(started);
      router.setParams({ runId: started.run_id });
    } catch (e: any) {
      setError(failMessage(e, 'Falha ao iniciar a execução.'));
    } finally {
      setLoading(false);
      setLoadingNote(null);
    }
  };

  const handleSelect = async (candidateId: string) => {
    if (!run) return;
    setLoading(true);
    setLoadingNote(run.is_synthetic_sample ? 'Processando fixture sintética no worker local…' : 'Adquirindo edital e processando evidências…');
    setError(null);
    try {
      setRun(await selectTenderProofCandidate(run.run_id, candidateId, run.mode));
    } catch (e: any) {
      setError(failMessage(e, 'Falha ao processar o edital.'));
    } finally {
      setLoading(false);
      setLoadingNote(null);
    }
  };

  const handleRefreshReplay = async () => {
    if (!run) return;
    setLoading(true);
    setError(null);
    try {
      setRun(await refreshTenderProofReplay(run.run_id));
    } catch (e: any) {
      setError(failMessage(e, 'Falha ao reconsultar o replay.'));
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!run) return;
    setLoading(true);
    setError(null);
    try {
      setRun(await reconcileTenderProofSessions(run.run_id));
    } catch (e: any) {
      setError(failMessage(e, 'Falha ao reconciliar sessões.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReplay = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (e: any) {
      setError(`Não foi possível abrir o replay: ${e?.message ?? e}`);
    }
  };

  const handleCheckPdf = async (pageNumber = 1, artifactId?: string | null) => {
    if (!run) return;
    const artifact = artifactId
      ? [run.artifact, ...(run.supplementary_documents ?? []).map(d => d.artifact)].find(a => a?.artifact_id === artifactId)
      : run.artifact;
    if (!artifact) { setPdfCheck('Documento desta evidência não está disponível na execução.'); return; }
    setPdfDownloadUrl(null);
    setPdfPage(pageNumber);
    setPdfCheck('Baixando bytes autenticados…');
    try {
      const bytes = await fetchTenderProofPdfBytes(run.run_id, artifact.artifact_id);
      const header = String.fromCharCode(...new Uint8Array(bytes.slice(0, 5)));
      const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
      const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
      if (bytes.byteLength !== artifact.byte_len || !header.startsWith('%PDF') || sha256 !== artifact.sha256) {
        throw new Error('O PDF recebido não corresponde ao tamanho ou SHA-256 do artefato.');
      }
      setPdfCheck(`PDF conferido por SHA-256. Evidência na página física ${pageNumber}.`);
      if (Platform.OS === 'web') {
        setPdfDownloadUrl(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })));
      } else {
        if (!(await Sharing.isAvailableAsync())) throw new Error('Visualização de PDF indisponível neste dispositivo.');
        const file = new File(Paths.cache, `${artifact.artifact_id}.pdf`);
        try {
          file.write(new Uint8Array(bytes));
          await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Edital — página ${pageNumber}` });
        } finally {
          if (file.exists) file.delete();
        }
      }
    } catch (e: any) {
      setPdfCheck(`Falha ao obter o PDF: ${failMessage(e, 'erro')}`);
    }
  };

  const stepIndex =
    run == null ? 0
    : run.execution_status === 'awaiting_selection' ? 1
    : run.execution_status === 'processing' ? 2
    : run.execution_status === 'completed' ? 3 : 0;
  const steps = ['Iniciar', 'Candidatos', 'Edital', 'Comparar'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>TenderProof</Text>
      <Text style={styles.subtitle}>Observações, documentos e revisão do catálogo</Text>
      {run && <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => setShowSources(value => !value)}>
        <Text style={styles.secondaryButtonText}>{showSources ? 'Recolher fontes e observações' : 'Mostrar fontes e observações'}</Text>
      </Pressable>}
      {(!run || showSources) && <ContinuousReview styles={styles} />}
      {!run && <Text style={styles.sampleNote}>A verificação avulsa usa uma seleção limitada. A coleta contínua aparece acima, com sua cobertura e pendências.</Text>}

      {!run && (
        <>
          <View style={styles.modeRow}>
            {(sources.length ? sources.filter(s => s.adapter_implemented) : [{ source: 'ibgp_open', name: 'IBGP', mock_available: true }, { source: 'imeso_open', name: 'IMESO', mock_available: true }]).map((item) => (
              <Pressable key={item.source} style={[styles.modeButton, source === item.source && styles.modeButtonActive]} onPress={() => { setSource(item.source); if (!item.mock_available) setMode('real'); }}>
                <Text style={styles.modeText}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Modo de execução</Text>
          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeButton, mode === 'mock' && styles.modeButtonActive]}
              onPress={() => setMode('mock')}
              disabled={sources.some(s => s.source === source && !s.mock_available)}
            >
              <Text style={[styles.modeText, mode === 'mock' && styles.modeTextActive]}>Demonstração</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, mode === 'real' && styles.modeButtonActive]}
              onPress={() => setMode('real')}
            >
              <Text style={[styles.modeText, mode === 'real' && styles.modeTextActive]}>Fonte oficial</Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>
            {mode === 'mock'
              ? 'Material sintético para demonstração (não é observação oficial).'
              : 'Consulta limitada à fonte oficial. O servidor aplica os limites e a política de aquisição; navegador, quando habilitado, pode ter custo.'}
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleStart} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryButtonText}>
                  {mode === 'mock' ? 'Iniciar demonstração' : 'Iniciar verificação real'}
                </Text>}
          </Pressable>
        </>
      )}

      {run?.is_synthetic_sample && (
        <Text style={styles.synthetic}>Demonstração offline com material sintético (não é observação oficial).</Text>
      )}
      {run && !run.is_synthetic_sample && (
        <Text style={styles.meta}>Execução real da fonte {run.source} (modo travado nesta execução).</Text>
      )}

      <View style={styles.stepsRow}>
        {steps.map((label, i) => (
          <View key={label} style={[styles.step, i <= stepIndex && styles.stepActive]}>
            <Text style={[styles.stepText, i <= stepIndex && styles.stepTextActive]}>{label}</Text>
          </View>
        ))}
      </View>

      {run && (
        <Text style={styles.meta}>
          Execução: {run.execution_status} · Validação documental: {run.validation_status}
          {run.execution_status === 'completed' && run.validation_status === 'valid'
            ? ' (identidade do edital confirmada — não significa todos os campos preenchidos)'
            : ''}
        </Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {run && <RecollectionReview key={run.run_id} run={run} onOpen={(id) => router.setParams({ runId: id })} />}

      {run && (
        <>
          <Text style={styles.sectionTitle}>Candidatos observados ({run.candidates.length})</Text>
          {run.candidates.map((c) => (
            <Pressable
              key={c.candidate_id}
              style={[
                styles.candidate,
                run.selected_candidate_id === c.candidate_id && styles.candidateSelected,
              ]}
              onPress={() => handleSelect(c.candidate_id)}
              disabled={loading || run.execution_status !== 'awaiting_selection'}
            >
              <Text style={styles.candidateTitle}>{c.title_observed ?? c.candidate_id}</Text>
              {!!c.selection_label_observed && <Text>{c.selection_label_observed}</Text>}
              <Text style={styles.candidateMeta}>
                {run.selected_candidate_id === c.candidate_id ? 'Selecionado' : run.execution_status === 'awaiting_selection' ? 'Toque para selecionar e processar o edital' : 'Não selecionado nesta execução'}
              </Text>
            </Pressable>
          ))}

          {run.document && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Documento escolhido</Text>
              <Text style={styles.body}>{run.document.title}</Text>
              <Text style={styles.meta}>{run.document.reason_chosen}</Text>
              {run.document_selection && <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => router.setParams({ runId: run.document_selection!.parent_run_id })}>
                <Text style={styles.secondaryButtonText}>Consultar extração anterior preservada</Text>
              </Pressable>}
              {run.artifact && (
                <Text style={styles.meta}>
                  PDF preservado ({run.processed_pages}/{run.total_pages} páginas
                  {run.truncated ? ', truncado' : ''}) · sha256 {run.artifact.sha256.slice(0, 16)}…
                </Text>
              )}
              {run.artifact && (
                <Pressable style={styles.secondaryButton} onPress={() => handleCheckPdf()} disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Verificar PDF autenticado</Text>
                </Pressable>
              )}
                {pdfCheck && <Text style={styles.meta}>{pdfCheck}</Text>}
                {Platform.OS === 'web' && pdfDownloadUrl && (
                  <a href={`${pdfDownloadUrl}#page=${pdfPage}`} target="_blank" rel="noreferrer">Abrir documento na página {pdfPage}</a>
                )}
            </View>
          )}

          {run.comparison.fields.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Campos: baseline × TenderProof</Text>
              <Text style={styles.meta}>
                Baseline: {run.comparison.baseline_origin}
                {run.comparison.baseline_collected_at
                  ? ` (coletada em ${new Date(run.comparison.baseline_collected_at).toLocaleString('pt-BR')})`
                  : ''}
              </Text>
              {run.comparison.fields.map((f) => {
                const tenderField = run.fields.find((x) => x.field_name === f.field_name);
                const pendingReason = extractionPendingReason(run.validation_status,tenderField,f);
                return (
                  <View key={f.field_name} style={styles.fieldBox}>
                    <View style={styles.fieldHeader}>
                      <Text style={styles.fieldName}>{FIELD_LABELS[f.field_name] ?? f.field_name}</Text>
                      <Text style={[styles.badge, { color: AGREEMENT_COLOR[f.agreement] }]}>
                        {pendingReason ? 'Extração pendente' : tenderField?.state === 'conflict' ? 'Conflito nas evidências' : AGREEMENT_LABEL[f.agreement]}
                      </Text>
                    </View>
                    <Text style={styles.body}>Baseline: {formatValue(f.baseline_value)}</Text>
                    <Text style={styles.body}>TenderProof: {formatValue(f.tenderproof_value)}</Text>
                    {!pendingReason && tenderField?.reason && tenderField.state !== 'supported' && (
                      <Text style={styles.meta}>
                        Estado {tenderField.state} — motivo: {tenderField.reason}
                      </Text>
                    )}
                    {(tenderField?.evidence ?? []).map((ev) => (
                      <Text key={ev.evidence_id} style={styles.meta} onPress={() => handleCheckPdf(ev.page_number ?? 1, ev.artifact_id)}>
                        Evidência{ev.page_number != null ? `, página ${ev.page_number}` : ''}
                        {ev.json_path ? `, campo ${ev.json_path}` : ''}:{' '}
                        {ev.snippet ?? '(sem trecho textual)'}
                      </Text>
                    ))}
                    <Text style={styles.meta}>{pendingReason ?? (tenderField?.state === 'conflict'
                      ? 'Há evidências conflitantes; nenhum valor foi escolhido automaticamente para comparar.'
                      : f.explanation)}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {run.fields.filter(f => !run.comparison.fields.some(c => c.field_name === f.field_name)).map(f => (
            <View key={f.field_name} style={styles.card}>
              <Text style={styles.sectionTitle}>{FIELD_LABELS[f.field_name] ?? f.field_name}</Text>
              <Text style={styles.meta}>Extração desta observação. Este campo não foi incluído na comparação registrada.</Text>
              <Text style={styles.body}>{f.state === 'supported' ? formatValue(f.value) : 'Pendente de conferência'}</Text>
              {f.reason && <Text style={styles.meta}>{f.reason}</Text>}
              {f.evidence.map(ev => (
                <Text key={ev.evidence_id} style={styles.meta} onPress={() => handleCheckPdf(ev.page_number ?? 1, ev.artifact_id)}>
                  Evidência, página {ev.page_number ?? '—'}: {ev.snippet}
                </Text>
              ))}
            </View>
          ))}
          {run.execution_status === 'completed' && <PublicationReview key={run.run_id} styles={styles} run={run} onEvidence={handleCheckPdf} />}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Sessões e replay</Text>
            {run.is_synthetic_sample && <Text style={styles.meta}>Registros abaixo são doubles offline; não são sessões nem replays do provedor.</Text>}
            {run.sessions.length === 0 && (
              <Text style={styles.meta}>Nenhuma sessão remota registrada nesta execução.</Text>
            )}
            {run.sessions.map((s, i) => (
              <View key={`${s.phase}-${i}`} style={styles.fieldBox}>
                <Text style={styles.fieldName}>
                  {s.phase === 'discovery' ? 'Discovery' : 'Detalhe/download'} · sessão {shortSession(s.session_id)}
                </Text>
                <Text style={styles.meta}>
                  Encerramento: {s.closed ? 'confirmado' : s.closure_status === 'requested' ? 'solicitado, sem confirmação' : 'desconhecido'} ·{' '}
                  {run.is_synthetic_sample ? 'Registro simulado; sem replay do provedor' : REPLAY_LABEL[s.replay_status]}
                  {s.replay_note ? ` — ${s.replay_note}` : ''}
                </Text>
                {!run.is_synthetic_sample && s.replay_status === 'available' && s.replay_url && (
                  <Pressable style={styles.secondaryButton} onPress={() => handleOpenReplay(s.replay_url!)}>
                    <Text style={styles.secondaryButtonText}>Abrir replay autorizado</Text>
                  </Pressable>
                )}
              </View>
            ))}
            {!run.is_synthetic_sample && (
              <View style={styles.buttonRow}>
                <Pressable style={styles.secondaryButton} onPress={handleRefreshReplay} disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Atualizar replay</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={handleReconcile} disabled={loading}>
                  <Text style={styles.secondaryButtonText}>Reconciliar sessões</Text>
                </Pressable>
              </View>
            )}
          </View>

          {(run.page_errors.length > 0 || run.validation.warnings.length > 0 || run.diagnostics.length > 0) && (
            <Text style={styles.meta}>
              Limitações e diagnóstico: {[...run.page_errors, ...run.validation.warnings, ...run.diagnostics].join(' · ')}
            </Text>
          )}
          {run.error && <Text style={styles.error}>{run.error}</Text>}
        </>
      )}

      {loading && <ActivityIndicator style={{ marginTop: 16 }} />}
      {loadingNote && <Text style={styles.meta}>{loadingNote}</Text>}
    </ScrollView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '900', color: theme.colors.primary },
  subtitle: { fontSize: 14, color: theme.colors.mutedText, marginTop: 4 },
  sampleNote: { fontSize: 12, color: theme.colors.mutedText, marginTop: 8, fontStyle: 'italic' },
  synthetic: { fontSize: 12, color: theme.colors.amberDark, marginTop: 8, fontWeight: 'bold' },
  stepsRow: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  step: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.colors.surfaceHighest, alignItems: 'center' },
  stepActive: { backgroundColor: theme.colors.primary },
  stepText: { fontSize: 11, fontWeight: 'bold', color: theme.colors.mutedText },
  stepTextActive: { color: '#fff' },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryButton: { borderWidth: 1, borderColor: theme.colors.primary, borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 8, flex: 1 },
  secondaryButtonText: { color: theme.colors.primary, fontWeight: 'bold', fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  modeButton: { flex: 1, borderWidth: 1, borderColor: theme.colors.surfaceHighest, borderRadius: 12, padding: 12, alignItems: 'center' },
  modeButtonActive: { borderColor: theme.colors.primary, borderWidth: 2 },
  modeText: { fontSize: 14, fontWeight: 'bold', color: theme.colors.mutedText },
  modeTextActive: { color: theme.colors.primary },
  error: { color: theme.colors.error, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.primary, marginTop: 16, marginBottom: 8 },
  candidate: { borderWidth: 1, borderColor: theme.colors.surfaceHighest, borderRadius: 12, padding: 12, marginBottom: 8 },
  candidateSelected: { borderColor: theme.colors.primary, borderWidth: 2 },
  candidateTitle: { fontSize: 15, fontWeight: 'bold', color: theme.colors.text },
  candidateMeta: { fontSize: 12, color: theme.colors.mutedText, marginTop: 4 },
  card: { marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceLowest },
  body: { fontSize: 14, color: theme.colors.text, marginTop: 4 },
  meta: { fontSize: 12, color: theme.colors.mutedText, marginTop: 4 },
  fieldBox: { borderTopWidth: 1, borderTopColor: theme.colors.surfaceHighest, paddingVertical: 10, marginTop: 8 },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldName: { fontSize: 15, fontWeight: '900', color: theme.colors.text },
  badge: { fontSize: 12, fontWeight: 'bold' },
});
