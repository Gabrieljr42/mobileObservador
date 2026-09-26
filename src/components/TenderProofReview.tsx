import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { resumoCargo } from '../utils/cargos';
import { DocumentEffectReview } from './DocumentEffectReview';
import { actTenderProofProposal, createTenderProofProposal, getTenderProofProposal, rollbackTenderProofProposal, getTenderProofContinuousStatus, getTenderProofObservations, getTenderProofCatalogue, getTenderProofDocumentReview, TenderProofDocumentReview, ContinuousCatalogueSource, ContinuousStatus, ContinuousObservation, TenderProofProposal, TenderProofRun, TenderProofAmendmentChange, TenderProofDocumentReference } from '../api/tenderproof';

const labels: Record<string, string> = { titulo: 'Título', orgao: 'Órgão', edital_numero: 'Número do edital', inscricao_inicio: 'Início das inscrições', inscricao_fim: 'Fim das inscrições', remuneracao: 'Remuneração' };
const states: Record<string, string> = { proposed: 'Aguardando revisão', approved: 'Aprovada, aguardando aplicação', applied: 'Aplicada', no_change: 'Sem alteração', rolled_back: 'Revertida', pending_review: 'Aguardando revisão', succeeded: 'Concluído no escopo percorrido', completed: 'Concluído no escopo percorrido', partial: 'Cobertura parcial', failed: 'Falhou', running: 'Em andamento', queued: 'Aguardando coleta' };
labels.cargos = 'Vagas, remuneração e requisitos por cargo';
labels.prova_data = 'Data da prova';
const value = (v: unknown) => v == null || v === '' ? 'Não informado' : Array.isArray(v) && v.every(c => c && typeof c.nome === 'string' && typeof c.remuneracao === 'string') ? v.map(resumoCargo).join('\n\n') : typeof v === 'object' ? JSON.stringify(v) : String(v);
const identityReason = (r?: string) => ({ source_external_url: 'Fonte, identificador e endereço correspondem ao cadastro', reviewed_organization_notice: 'Órgão e número do edital sustentam a associação revisada', new_verified_identity: 'Identidade documental verificada para um novo cadastro' }[r ?? ''] ?? r ?? 'Consulte a identidade da observação');
const errorMessage = (e: any) => e?.response?.status === 401 ? 'Entre na sua conta para consultar as observações e revisar propostas.' : typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'Não foi possível concluir. Atualize a situação antes de repetir.';
const reason = (r: string) => ({ candidate_limit: 'Limite de concursos por ciclo atingido', listing_page_limit: 'Limite de páginas atingido', document_list_truncated: 'Lista de documentos incompleta', listing_candidates_truncated: 'Listagem incompleta', cycle_timeout: 'Prazo do ciclo atingido', listing_terminal_unproven: 'Fim da listagem não comprovado' }[r] ?? r);
const isAmendmentProposal = (proposal?: TenderProofProposal | null) => proposal?.kind === 'field_amendment' || !!proposal?.changes;
const jsonValue = (value: unknown) => value == null ? 'Não informado' : typeof value === 'string' ? value : JSON.stringify(value);
const amendmentFields = (proposal: TenderProofProposal) => isAmendmentProposal(proposal) ? Object.keys(proposal.changes ?? {}) : (proposal.eligible_fields ?? []);
const amendmentEvidence = (change?: TenderProofAmendmentChange) => (change?.provenance ?? []).map((item, index) => ({
  ...item,
  evidence_id: `${change?.field_name ?? 'field'}-${index}`,
  page_number: item.page_number ?? item.page ?? null,
  snippet: item.snippet ?? null,
  artifact_id: null,
  document_sha256: item.document_sha256 ?? item.sha256 ?? null,
  json_path: null,
  method: 'provenance',
  method_version: '1',
}));
const openDocument = (document: TenderProofDocumentReference | null | undefined, setError: (message: string) => void) => {
  if (document?.url) void Linking.openURL(document.url).catch(() => setError('Não foi possível abrir o documento oficial.'));
};

type Props = { styles: any };
function DocumentReviewNotice({ review, styles: s }: Props & { review?: TenderProofDocumentReview | null }) {
  const [showDocuments, setShowDocuments] = useState(false);
  if (!review?.pending) return null;
  return <View style={s.fieldBox}>
    <Text accessibilityRole="alert" style={s.error}>Documentos novos ou alterados aguardam revisão dos efeitos</Text>
    <Text style={s.body}>{review.reason || 'Os efeitos dos documentos novos ou alterados ainda não foram demonstrados.'}</Text>
    <Text style={s.meta}>A publicação permanece impedida. Os valores atuais do catálogo serão preservados.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDocuments }} style={s.secondaryButton} onPress={() => setShowDocuments(v => !v)}>
      <Text style={s.secondaryButtonText}>{showDocuments ? 'Recolher lista de documentos' : `Consultar lista de documentos (${review.documents.length})`}</Text>
    </Pressable>
    {showDocuments && review.documents.map((doc, i) => <View key={`${doc.url}-${i}`}>
      <Text style={s.fieldName}>{doc.title}</Text>
      {doc.change === 'bytes_changed' && <Text style={s.body}>O conteúdo deste arquivo mudou no mesmo endereço. A revisão anterior precisa ser refeita.</Text>}
      <Text selectable style={s.meta}>{doc.url}</Text>
    </View>)}
  </View>;
}
export function ContinuousReview({ styles: s }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ContinuousStatus | null>(null);
  const [observations, setObservations] = useState<ContinuousObservation[]>([]);
  const [catalogue, setCatalogue] = useState<ContinuousCatalogueSource[]>([]);
  const [filter, setFilter] = useState('');
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async (page = 0) => {
    setBusy(true); setError('');
    try {
      const [st, obs, cat] = await Promise.all([getTenderProofContinuousStatus(), getTenderProofObservations(page), getTenderProofCatalogue()]);
      setStatus(st); setObservations(obs); setCatalogue(cat); setOffset(page);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  return <View style={s.card}>
    <Text style={s.sectionTitle}>Fontes e observações contínuas</Text>
    <Text style={s.meta}>A coleta prepara evidências. Cada publicação exige revisão dos campos e aplicação autorizada.</Text>
    {!!catalogue.length && <Text style={s.body}>{catalogue.length} fontes no inventário · {catalogue.filter(c => c.adapter_registered).length} adaptadores registrados · {catalogue.filter(c => c.adapter_implemented).length} implementados. Implementação não comprova homologação ou cobertura integral.</Text>}
    <Pressable style={s.secondaryButton} onPress={() => setShowCatalogue(!showCatalogue)}><Text style={s.secondaryButtonText}>{showCatalogue ? 'Recolher inventário' : 'Consultar todas as fontes e pendências'}</Text></Pressable>
    {showCatalogue && <>
      <TextInput accessibilityLabel="Filtrar fontes por nome" style={s.body} placeholder="Buscar fonte" value={filter} onChangeText={setFilter} />
      {catalogue.filter(c => `${c.name} ${c.source}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(c => <View key={c.source} style={s.fieldBox}>
        <Text style={s.fieldName}>{c.number}. {c.name}</Text>
        <Text style={s.meta}>{c.category === 'banca' ? 'Banca' : 'Seleções institucionais'} · {c.implementation_state === 'partial' ? 'Adaptador parcial' : c.adapter_implemented ? 'Adaptador implementado' : 'Adaptador pendente'}</Text>
        {!!c.implementation_scope && <Text style={s.meta}>{c.implementation_scope}</Text>}
        <Text style={s.meta}>Homologação: {c.homologation === 'pending_adapter' ? 'pendente de implementação e validação' : c.homologation === 'see_validation_matrix' ? 'consulte o escopo e as restrições na matriz de validação' : c.homologation}</Text>
        {c.listing_urls.map(url => <Text key={url} selectable style={s.meta}>{url}</Text>)}
      </View>)}
    </>}
    {status && <>
      <Text style={s.body}>Coleta geral: {status.operationally_enabled ? 'habilitada' : 'desativada'} · {status.operator_authorized ? 'operador autorizado' : 'consulta de histórico'}</Text>
      {status.sources.length === 0 && <Text style={s.meta}>Nenhuma fonte configurada para este usuário. Isso não significa ausência de concursos.</Text>}
      {status.sources.map(source => <View key={source.source} style={s.fieldBox}>
        <Text style={s.fieldName}>{source.source} · {source.enabled && status.operationally_enabled ? 'coleta habilitada' : 'coleta pausada'}</Text>
        <Text style={s.body}>{source.known_candidates} concursos acompanhados · {source.pending_reviews} observações para revisão · {source.mode === 'mock' ? 'material sintético' : 'observações reais'}</Text>
        {!!source.browser_hold && <Text style={s.error}>Aquisição com navegador suspensa: encerramento de sessão precisa de conferência operacional.</Text>}
        {source.cycles.length ? <>
          <Text style={s.meta}>Último ciclo: {states[source.cycles[0].status] ?? source.cycles[0].status}</Text>
          {source.cycles[0].reasons.map((r, i) => <Text key={i} style={s.meta}>{reason(r)}</Text>)}
        </> : <Text style={s.meta}>Sem ciclo registrado; cobertura ainda não demonstrada.</Text>}
      </View>)}
    </>}
    <Pressable accessibilityRole="button" style={s.secondaryButton} disabled={busy} onPress={() => load(offset)}><Text style={s.secondaryButtonText}>Atualizar fontes e observações</Text></Pressable>
    {observations.map(obs => <View key={obs.observation_id} style={s.fieldBox}>
      <Text style={s.fieldName}>{obs.summary.title || 'Concurso sem título observado'}</Text>
      <Text style={s.meta}>Fonte: {obs.source} · {obs.mode === 'mock' ? 'sintético' : 'real'} · {states[obs.status] ?? obs.status}</Text>
      <Text style={s.meta}>Última observação: {new Date(obs.last_seen * 1000).toLocaleString('pt-BR')} · {obs.summary.documents?.length ?? 0} documentos identificados</Text>
      <Text style={s.meta}>Validação documental: {obs.summary.validation_status === 'valid' ? 'identidade confirmada' : 'pendente ou impedida'}. Cadastro novo ou atualização será determinado na comparação.</Text>
      {!!obs.summary.review_reason && <Text style={s.error}>{String(obs.summary.review_reason)}</Text>}
      <DocumentReviewNotice styles={s} review={obs.summary.document_review} />
      {obs.summary.document_bytes_verified === false && <Text style={s.error}>Somente links observados; bytes documentais não verificados. Esta observação não está pronta para publicação.</Text>}
      {(!!obs.summary.documents_truncated || !!obs.summary.truncated_pdf) && <Text style={s.error}>Evidência incompleta: revise os limites de documentos e páginas.</Text>}
      {obs.summary.documents?.map((doc: any, i) => <Text key={i} style={s.meta}>{doc.title} · {doc.kind ?? 'tipo não determinado'}{doc.kind === 'retificacao' ? ' — efeitos precisam de revisão; não aplicados automaticamente' : ''}</Text>)}
      <Pressable accessibilityRole="button" style={s.secondaryButton} disabled={busy} onPress={() => router.push({ pathname: '/tenderproof', params: { runId: obs.run_id } })}><Text style={s.secondaryButtonText}>Revisar observação e documento</Text></Pressable>
    </View>)}
    {!busy && !error && observations.length === 0 && <Text style={s.meta}>Nenhuma observação nesta página. Consulte a situação e a cobertura das fontes acima.</Text>}
    <View style={s.buttonRow}>
      <Pressable style={s.secondaryButton} disabled={busy || offset === 0} onPress={() => load(Math.max(0, offset - 20))}><Text style={s.secondaryButtonText}>Anteriores</Text></Pressable>
      <Pressable style={s.secondaryButton} disabled={busy || observations.length < 20} onPress={() => load(offset + 20)}><Text style={s.secondaryButtonText}>Próximas</Text></Pressable>
    </View>
    {busy && <ActivityIndicator />}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}

export function PublicationReview({ styles: s, run, onEvidence }: Props & { run: TenderProofRun; onEvidence: (page: number, artifactId?: string | null) => void }) {
  const [target, setTarget] = useState('');
  const [proposal, setProposal] = useState<TenderProofProposal | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [rollbackReason, setRollbackReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mustRefresh, setMustRefresh] = useState(false);
  const [documentReview, setDocumentReview] = useState<TenderProofDocumentReview | null>(null);
  useEffect(() => {
    let current = true;
    setDocumentReview(null);
    getTenderProofDocumentReview(run.run_id).then(review => { if (current) setDocumentReview(review); })
      .catch(e => { if (current) setError(errorMessage(e)); });
    return () => { current = false; };
  }, [run.run_id]);
  const currentDocumentReview = proposal?.document_review?.pending ? proposal.document_review : documentReview;
  const documentBlocked = !documentReview || !!currentDocumentReview?.pending;
  const execute = async (work: () => Promise<TenderProofProposal>) => {
    setBusy(true); setError('');
    try { setProposal(await work()); setDocumentReview(await getTenderProofDocumentReview(run.run_id)); setMustRefresh(false); }
    catch (e: any) { setError(errorMessage(e)); setMustRefresh(true); }
    finally { setBusy(false); }
  };
  const editable = !!proposal && proposal.state === 'proposed' && !proposal.stale && !mustRefresh && !documentBlocked;
  const required = proposal?.required_fields ?? [];
  const ready = editable && fields.length > 0 && required.every(f => fields.includes(f));
  return <View style={s.card}>
    <Text style={s.sectionTitle}>Revisar publicação no catálogo</Text>
    <Text style={s.body}>Fonte: {run.source} · {run.candidates.find(c => c.candidate_id === run.selected_candidate_id)?.title_observed ?? 'Concurso observado'}</Text>
    {!!run.candidates.find(c => c.candidate_id === run.selected_candidate_id)?.selection_label_observed && <Text style={s.body}>
      Seleção: {run.candidates.find(c => c.candidate_id === run.selected_candidate_id)?.selection_label_observed}
    </Text>}
    <DocumentReviewNotice styles={s} review={currentDocumentReview} />
    {!!currentDocumentReview?.pending && <DocumentEffectReview key={run.run_id} runId={run.run_id} styles={s} onApproved={async () => {
      setDocumentReview(await getTenderProofDocumentReview(run.run_id)); setProposal(null); setFields([]);
    }} />}
    {!documentReview && <Text style={s.meta}>Consulte a situação dos documentos antes de preparar uma publicação.</Text>}
    <Pressable style={s.secondaryButton} disabled={busy} onPress={async () => {
      setBusy(true); setError('');
      try { setDocumentReview(await getTenderProofDocumentReview(run.run_id)); }
      catch (e) { setError(errorMessage(e)); }
      finally { setBusy(false); }
    }}><Text style={s.secondaryButtonText}>Atualizar situação dos documentos</Text></Pressable>
    <Text style={s.meta}>Deixe o ID vazio para conferir a identidade e preparar cadastro novo ou atualização. Para associar a um concurso conhecido, informe seu ID; a evidência será conferida pelo servidor.</Text>
    <TextInput accessibilityLabel="ID do concurso existente, opcional" style={s.body} value={target} onChangeText={v => { setTarget(v); setProposal(null); setFields([]); }} keyboardType="number-pad" placeholder="ID do concurso existente (opcional)" editable={!busy} />
    <Pressable style={s.secondaryButton} disabled={busy || documentBlocked || (!!target && !/^[1-9]\d*$/.test(target))} onPress={() => { setFields([]); void execute(() => createTenderProofProposal(run.run_id, target ? Number(target) : null)); }}><Text style={s.secondaryButtonText}>Conferir identidade e preparar proposta</Text></Pressable>
    {proposal && <>
      {isAmendmentProposal(proposal) ? <Text style={s.fieldName}>Retificação do concurso {proposal.concurso_id ?? 'não informado'}</Text> : <Text style={s.fieldName}>{proposal.action === 'create' ? 'Novo cadastro' : `Atualização do concurso ${proposal.concurso_id}`}</Text>}
      <Text style={s.body}>{states[proposal.state] ?? proposal.state}</Text>
      <Text style={s.meta}>Associação: {identityReason(proposal.identity?.reason ?? undefined)} · ID na fonte: {proposal.identity?.external_id ?? 'não informado'}</Text>
      {!!proposal.identity?.detail_url && <Text selectable style={s.meta}>Página oficial: {proposal.identity.detail_url}</Text>}
      {isAmendmentProposal(proposal) && <View style={s.fieldBox}>
        <Text style={s.body}>Proposta de retificação revisável antes da aprovação.</Text>
        {!!proposal.reason && <Text style={s.meta}>Motivo: {proposal.reason}</Text>}
        {proposal.base_document && <Pressable accessibilityRole="link" onPress={() => openDocument(proposal.base_document, setError)}>
          <Text selectable style={s.meta}>Documento base: {proposal.base_document.title || proposal.base_document.sha256 || 'documento preservado'}{proposal.base_document.url ? ' · Abrir PDF oficial' : ''}</Text>
        </Pressable>}
        {proposal.amendment_document && <Pressable accessibilityRole="link" onPress={() => openDocument(proposal.amendment_document, setError)}>
          <Text selectable style={s.meta}>Documento retificador: {proposal.amendment_document.title || proposal.amendment_document.sha256 || 'documento preservado'}{proposal.amendment_document.url ? ' · Abrir PDF oficial' : ''}</Text>
        </Pressable>}
        {!!proposal.periods && <Text style={s.meta}>Períodos: {jsonValue(proposal.periods)}</Text>}
        {!!proposal.events?.length && proposal.events.map((event, index) => <Text key={index} style={s.meta}>Evento {index + 1}: {jsonValue(event)}</Text>)}
        {!!proposal.authorization && <Text style={s.meta}>Autorização: {jsonValue(proposal.authorization)}</Text>}
      </View>}
      {proposal.document_access && <View style={s.fieldBox}>
        <Text style={s.body}>O PDF foi preservado. O portal disponibiliza este documento pela página oficial.</Text>
        <Pressable accessibilityRole="button" style={s.secondaryButton} onPress={() => onEvidence(1)}><Text style={s.secondaryButtonText}>Conferir e baixar PDF autenticado</Text></Pressable>
        <Pressable accessibilityRole="link" style={s.secondaryButton} onPress={() => { void Linking.openURL(proposal.document_access!.official_page_url).catch(() => setError('Não foi possível abrir a página oficial.')); }}><Text style={s.secondaryButtonText}>Abrir página oficial do edital</Text></Pressable>
      </View>}
      {proposal.creation_metadata && <>
        <Text style={s.body}>Banca no novo cadastro: {proposal.creation_metadata.banca}</Text>
        <Text selectable style={s.meta}>{proposal.document_access ? 'Página oficial que será vinculada' : 'Edital oficial que será vinculado'}: {proposal.document_access?.official_page_url ?? proposal.creation_metadata.link_edital}</Text>
      </>}
      {(proposal.stale || mustRefresh) && <Text style={s.error}>A proposta precisa ser atualizada. Se o catálogo mudou, prepare outra proposta e revise os campos novamente.</Text>}
      {(proposal.blockers ?? []).map((b, i) => <Text key={i} style={s.error}>{b}</Text>)}
      <Text style={s.meta}>Somente os campos aprovados abaixo serão publicados. Informações desconhecidas ou conflitantes preservam os valores existentes.</Text>
      {amendmentFields(proposal).map(field => <View key={field} style={s.fieldBox}>
        {(() => { const amendmentChange = proposal.changes?.[field]; const oldValue = isAmendmentProposal(proposal) ? amendmentChange?.previous : proposal.baseline?.values?.[field]; const newValue = isAmendmentProposal(proposal) ? amendmentChange?.new : proposal.proposed?.[field]; const evidenceItems = isAmendmentProposal(proposal) ? amendmentEvidence(amendmentChange) : (proposal.evidences?.[field]?.items ?? []); return <>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: fields.includes(field), disabled: !editable || busy }} disabled={busy || !editable} onPress={() => setFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])}>
          <Text style={s.fieldName}>{(proposal.state === 'proposed' ? fields : proposal.approved_fields ?? []).includes(field) ? '☑' : '☐'} {labels[field] ?? amendmentChange?.label ?? field}{required.includes(field) ? ' (obrigatório para cadastro)' : ''}</Text>
          <Text style={s.body}>Atual: {value(oldValue)}</Text>
          <Text style={s.body}>{isAmendmentProposal(proposal) ? 'Novo valor' : 'Publicar'}: {value(newValue)}</Text>
          {!!amendmentChange?.reason && <Text style={s.meta}>Motivo do campo: {amendmentChange.reason}</Text>}
        </Pressable>
        {!!(isAmendmentProposal(proposal) ? amendmentChange?.provenance?.length : proposal.evidences?.[field]?.document_sha256) && !isAmendmentProposal(proposal) && <Text selectable style={s.meta}>SHA-256 do documento: {proposal.evidences?.[field]?.document_sha256}</Text>}
        {evidenceItems.map((ev, i) => <Pressable key={i} accessibilityRole="button" onPress={() => onEvidence(ev.page_number ?? 1, ev.artifact_id)}>
          <Text style={s.meta}>Documento preservado · página física {ev.page_number ?? 'não informada'}: {ev.snippet ?? 'Sem trecho'}</Text>
          {ev.source_url && <Text selectable style={s.meta}>{ev.source_url}</Text>}
        </Pressable>)}
        </>; })()}
      </View>)}
      {Object.entries(proposal.blocked_fields ?? {}).map(([field, why]) => <View key={field} style={s.fieldBox}>
        <Text style={s.error}>{labels[field] ?? field}: impedido — {why}</Text>
        <Text style={s.meta}>{proposal.baseline?.values && field in proposal.baseline.values ? `Valor atual preservado: ${value(proposal.baseline.values[field])}` : 'Nenhuma alteração aprovada neste campo; valores válidos do catálogo serão preservados.'}</Text>
        {proposal.evidences?.[field]?.items?.map((ev, i) => <Text key={i} style={s.meta} onPress={() => onEvidence(ev.page_number ?? 1, ev.artifact_id)}>Página {ev.page_number ?? 'não informada'}: {ev.snippet}</Text>)}
      </View>)}
      <Pressable style={s.secondaryButton} disabled={busy || !ready || !!proposal.blockers?.length} onPress={() => execute(() => actTenderProofProposal(proposal, 'approve', fields))}><Text style={s.secondaryButtonText}>{isAmendmentProposal(proposal) ? `Aprovar os ${fields.length} campos da retificação` : `Aprovar os ${fields.length} campos selecionados`}</Text></Pressable>
      {proposal.state === 'approved' && <Text style={s.body}>Aplicar irá {isAmendmentProposal(proposal) ? 'aplicar a retificação' : proposal.action === 'create' ? 'cadastrar um concurso' : 'alterar este concurso'} com os campos: {(proposal.approved_fields ?? fields).map(f => labels[f] ?? proposal.changes?.[f]?.label ?? f).join(', ')}.</Text>}
      <Pressable style={s.secondaryButton} disabled={busy || documentBlocked || mustRefresh || !!proposal.stale || proposal.state !== 'approved'} onPress={() => execute(() => actTenderProofProposal(proposal, 'apply'))}><Text style={s.secondaryButtonText}>{isAmendmentProposal(proposal) ? 'Aplicar retificação' : proposal.action === 'create' ? 'Cadastrar concurso com campos aprovados' : 'Aplicar alterações aprovadas'}</Text></Pressable>
      <Pressable style={s.secondaryButton} disabled={busy} onPress={() => execute(() => getTenderProofProposal(proposal.id))}><Text style={s.secondaryButtonText}>Consultar situação da proposta</Text></Pressable>
      {proposal.result && <>
        <Text style={s.body}>{proposal.state === 'no_change' ? 'Nenhum dado mudou; nenhuma versão criada.' : `${isAmendmentProposal(proposal) ? 'Retificação' : `Concurso ${proposal.concurso_id}`} · versão ${proposal.version_id ?? 'não informada'}`}</Text>
        {Object.entries(proposal.result.diff ?? {}).map(([field, delta]) => <Text key={field} style={s.body}>{labels[field] ?? field}: {value(delta.old)} → {value(delta.new)}</Text>)}
        {proposal.result.notification_status && <Text style={s.meta}>Notificações: {proposal.result.notification_status === 'outbox_pending' ? 'evento registrado após publicação; consultar processamento' : value(proposal.result.notification_status)}</Text>}
      </>}
      {proposal.approved_by != null && <Text style={s.meta}>Aprovação: operador {proposal.approved_by} · {proposal.approved_at}</Text>}
      {proposal.state === 'applied' && !isAmendmentProposal(proposal) && <>
        <Text style={s.meta}>{proposal.action === 'create' ? 'Reverter o cadastro arquiva o concurso e preserva o histórico.' : 'Reverter restaura os campos anteriores e cria uma versão de correção.'} Alterações posteriores podem impedir a reversão.</Text>
        <TextInput accessibilityLabel="Motivo da reversão" style={s.body} placeholder="Descreva o motivo da reversão" value={rollbackReason} onChangeText={setRollbackReason} editable={!busy} />
        <Pressable style={s.secondaryButton} disabled={busy || mustRefresh || !rollbackReason.trim()} onPress={() => execute(() => rollbackTenderProofProposal(proposal.id, rollbackReason.trim()))}><Text style={s.secondaryButtonText}>{proposal.action === 'create' ? 'Reverter e arquivar cadastro' : 'Reverter alterações publicadas'}</Text></Pressable>
      </>}
      {proposal.rollback_version_id && <Text style={s.body}>Reversão confirmada · versão {proposal.rollback_version_id} · {proposal.rollback_reason}</Text>}
    </>}
    {busy && <ActivityIndicator />}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}
