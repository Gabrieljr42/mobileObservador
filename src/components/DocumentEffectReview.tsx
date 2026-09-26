import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Linking } from 'react-native';
import { currentDocumentEffects, prepareDocumentEffects, approveDocumentEffects, saveDocumentEffectsDraft, selectPreservedDocument, DocumentEffectCase, DocumentEffectDecision } from '../api/tenderproof';
import { useRouter } from 'expo-router';
import { registrationListsText } from '../utils/registrationLists';
import { OCRRegionReview } from './OCRRegionReview';

const fieldLabels: Record<string, string> = {
  titulo: 'Título', orgao: 'Órgão', edital_numero: 'Número do edital',
  inscricao_inicio: 'Início das inscrições', inscricao_fim: 'Fim das inscrições',
  prova_data: 'Data da prova', cargos: 'Cargos e requisitos',
  remuneracao: 'Remuneração', taxas_inscricao: 'Taxas de inscrição por escolaridade',
  inscricao_listas: 'Períodos de inscrição por lista',
};
const stateLabels = { supported: 'Com evidência', conflict: 'Informações em conflito', failed: 'Extração pendente', unknown: 'Sem evidência suficiente' };

function fieldValue(value: unknown): string {
  if (value == null) return '';
  const lists = registrationListsText(value);
  if (lists !== null) return lists;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const fees = value as Record<string, unknown>;
    if (typeof fees.medio_tecnico === 'string' && typeof fees.superior === 'string') {
      const money = (v: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return `Médio/técnico: ${money(fees.medio_tecnico)} · Superior: ${money(fees.superior)}`;
    }
  }
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function DocumentEffectReview({ runId, styles: s, onApproved }: { runId: string; styles: any; onApproved: () => Promise<void> }) {
  const router = useRouter();
  const [selectionReasons, setSelectionReasons] = useState<Record<string, string>>({});
  const [review, setReview] = useState<DocumentEffectCase | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Partial<DocumentEffectDecision>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [documentIndex, setDocumentIndex] = useState(0);
  const [documentSearch, setDocumentSearch] = useState('');
  const [draftDirty, setDraftDirty] = useState(false);
  const [viewedPages, setViewedPages] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    setReview(null); setDecisions({}); setBusy(true); setError(''); setDraftDirty(false);
    setDocumentIndex(0); setDocumentSearch('');
    setViewedPages({});
    currentDocumentEffects(runId).then(value => { if (active) {
      setReview(value); setDecisions(Object.fromEntries((value?.draft ?? []).map(d => [d.sha256, d])));
    } })
      .catch(() => { if (active) setError('Não foi possível recuperar a preparação anterior. Tente preparar os documentos novamente.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [runId]);
  const documents = review?.documents.filter((d, i, all) => all.findIndex(x => x.artifact.sha256 === d.artifact.sha256) === i) ?? [];
  const update = (hash: string, value: Partial<DocumentEffectDecision>) => {
    setDraftDirty(true);
    setDecisions(prior => ({ ...prior, [hash]: { ...prior[hash], ...value, sha256: hash } }));
  };
  const ready = documents.length > 0 && documents.every(d => {
    const v = decisions[d.artifact.sha256];
    return v?.effect && v.page && (v.snippet?.trim().length ?? 0) >= 20 && (v.reason?.trim().length ?? 0) >= 20;
  });
  async function execute(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); }
    catch (e: any) { setError(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'Não foi possível concluir a revisão. Atualize a coleta e tente novamente.'); }
    finally { setBusy(false); }
  }
  return <View style={s.fieldBox}>
    <Text style={s.fieldName}>Conferir efeitos das retificações</Text>
    <Text style={s.body}>Confira cada documento e indique se seus efeitos já constam no edital selecionado ou se não alteram os dados extraídos. Se houver dados incorretos ou ausentes, mantenha a pendência para correção.</Text>
    <Pressable accessibilityRole="button" disabled={busy} style={s.secondaryButton} onPress={() => execute(async () => {
      setReview(await prepareDocumentEffects(runId)); setDecisions({}); setDocumentIndex(0); setDocumentSearch(''); setDraftDirty(false); setViewedPages({});
    })}><Text style={s.secondaryButtonText}>{review ? 'Atualizar preparação dos documentos' : 'Preparar documentos para conferência'}</Text></Pressable>
    <Text style={s.body}>Se a preparação for interrompida, use este botão para retomar. A fonte será consultada novamente; processamentos concluídos serão reutilizados quando os documentos e os limites continuarem iguais.</Text>
    {!!review && <>
      <Text style={s.body}>Salve um rascunho para continuar depois. Salvar não aprova a revisão nem libera a publicação.</Text>
      <Pressable accessibilityRole="button" disabled={busy || !draftDirty} style={s.secondaryButton} onPress={() => execute(async () => {
        const saved = await saveDocumentEffectsDraft(runId, review, Object.values(decisions));
        setReview({ ...review, ...saved }); setDraftDirty(false);
      })}><Text style={s.secondaryButtonText}>Salvar rascunho da conferência</Text></Pressable>
      <Text accessibilityLiveRegion="polite" style={s.meta}>{draftDirty ? 'Há alterações não salvas. Salve antes de sair ou atualizar a preparação.' : review.draft_saved_at ? 'Rascunho salvo. Você pode fechar e retomar esta conferência.' : 'Nenhum rascunho salvo.'}</Text>
    </>}
    {!!documents.length && <View style={s.fieldBox}>
      <Text style={s.fieldName}>Documento {documentIndex + 1} de {documents.length}</Text>
      <Text style={s.meta}>As decisões digitadas são mantidas ao trocar de documento. Salve o rascunho antes de fechar a tela.</Text>
      <View style={s.buttonRow}>
        <Pressable accessibilityRole="button" disabled={busy || documentIndex === 0} onPress={() => setDocumentIndex(i => i - 1)}><Text style={s.secondaryButtonText}>Documento anterior</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy || documentIndex >= documents.length - 1} onPress={() => setDocumentIndex(i => i + 1)}><Text style={s.secondaryButtonText}>Próximo documento</Text></Pressable>
      </View>
      <TextInput accessibilityLabel="Buscar documento preparado pelo título" placeholder="Buscar documento pelo título" style={s.body} value={documentSearch} onChangeText={setDocumentSearch} />
      {!!documentSearch.trim() && documents.map((d, index) => ({ d, index }))
        .filter(({ d }) => d.document.title.toLocaleLowerCase().includes(documentSearch.trim().toLocaleLowerCase()))
        .map(({ d, index }) => <Pressable key={d.artifact.sha256} accessibilityRole="button" disabled={busy} onPress={() => { setDocumentIndex(index); setDocumentSearch(''); }}>
          <Text style={s.secondaryButtonText}>{index + 1}. {d.document.title}</Text>
        </Pressable>)}
    </View>}
    {documents.slice(documentIndex, documentIndex + 1).map(d => {
      const hash = d.artifact.sha256;
      const decision = decisions[hash] ?? {};
      const page = d.pages.find(p => p.page_number === (viewedPages[hash] ?? decision.page ?? 1)) ?? d.pages[0];
      const viewPage = (number: number) => setViewedPages(prior => ({ ...prior, [hash]: number }));
      return <View key={hash} style={s.fieldBox}>
        <Text style={s.fieldName}>{d.document.title}</Text>
        {hash === review?.selected_document_sha256 && <Text style={s.meta}>Documento usado na extração atual</Text>}
        {hash !== review?.selected_document_sha256 && ['edital', 'consolidado'].includes(d.document.kind ?? '') && <View style={s.fieldBox}>
          <Text style={s.body}>Usar este documento cria uma nova extração e mantém a anterior no histórico. Os efeitos ainda precisarão de conferência antes da publicação.</Text>
          <TextInput accessibilityLabel={`Justificativa para selecionar ${d.document.title}`} placeholder="Explique por que este edital deve ser utilizado" multiline editable={!busy} style={s.body}
            value={selectionReasons[hash] ?? ''} onChangeText={value => setSelectionReasons(prior => ({ ...prior, [hash]: value }))} />
          <Pressable accessibilityRole="button" disabled={busy || (selectionReasons[hash]?.trim().length ?? 0) < 20} style={s.secondaryButton} onPress={() => execute(async () => {
            if (!review) return;
            const selected = await selectPreservedDocument(runId, review, d.artifact.artifact_id, selectionReasons[hash]);
            router.setParams({ runId: selected.run_id });
          })}><Text style={s.secondaryButtonText}>Extrair dados usando este edital</Text></Pressable>
        </View>}
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(d.document.url)}><Text style={s.secondaryButtonText}>Abrir documento oficial</Text></Pressable>
        {d.scope && <View style={s.fieldBox}>
          <Text style={s.fieldName}>Natureza da seleção: bolsa de pesquisa</Text>
          <Text style={s.body}>{d.scope.reason}</Text>
          <Text style={s.body}>Confira os trechos no documento. Esta indicação não aprova a revisão nem exclui outros editais da fonte.</Text>
          {d.scope.evidence.map((e, i) => <View key={i}>
            <Text selectable style={s.body}>{e.snippet}</Text>
            <Pressable accessibilityRole="button" onPress={() => viewPage(e.page_number)}>
              <Text style={s.secondaryButtonText}>Conferir natureza da seleção na página {e.page_number}</Text>
            </Pressable>
          </View>)}
        </View>}
        {d.fields ? <View style={s.fieldBox}>
          <Text style={s.fieldName}>Dados identificados neste documento</Text>
          <Text style={s.body}>Confira os conflitos e as pendências antes de registrar o efeito. Estes dados ainda não foram aplicados ao catálogo.</Text>
          {d.fields.filter(f => f.state !== 'unknown').map(f => <View key={f.field_name} style={s.fieldBox}>
            <Text style={s.fieldName}>{fieldLabels[f.field_name] ?? f.field_name} · {stateLabels[f.state]}</Text>
            {f.value != null && <Text selectable style={s.body}>{fieldValue(f.value)}</Text>}
            {!!f.reason && <Text style={s.body}>{f.reason}</Text>}
            {[...new Set(f.evidence.map(e => e.page_number).filter((p): p is number => p != null))].map(p =>
              <Pressable key={p} accessibilityRole="button" disabled={busy} onPress={() => viewPage(p)}>
                <Text style={s.secondaryButtonText}>Conferir evidência na página {p}</Text>
              </Pressable>)}
          </View>)}
        </View> : <Text style={s.body}>Atualize a preparação para identificar os dados de cada documento.</Text>}
        {!!d.ocr_review_required && <Text style={s.body}>Este documento contém páginas digitalizadas. A extração automática de campos dessas páginas continua pendente; confira o documento oficial antes de registrar seu efeito.</Text>}
        <Text style={s.meta}>Página física {page.page_number} de {d.pages.length} · {page.extraction_method === 'ocr_tesseract' ? 'texto reconhecido por OCR' : 'texto do PDF preservado'}</Text>
        {page.extraction_method === 'ocr_tesseract' && <Text style={s.body}>O reconhecimento pode trocar caracteres ou misturar colunas e atos diferentes. Confira o trecho na mesma página do PDF. Método: {page.extractor_version}.</Text>}
        {page.extraction_method === 'ocr_tesseract' && review && <OCRRegionReview key={`${hash}:${page.page_number}`}
          runId={runId} review={review} artifactId={d.artifact.artifact_id} pageNumber={page.page_number} styles={s} disabled={busy}
          selected={review.ocr_regions?.find(r=>r.id===decision.region_id && r.page_number===page.page_number)}
          onCreated={region => setReview(prior => prior ? { ...prior, ocr_regions: [...(prior.ocr_regions ?? []).filter(r=>r.id!==region.id),region] } : prior)}
          onUse={region => update(hash,{page:region.page_number,region_id:region.id,snippet:'',reason:'',effect:undefined})} />}
        {!!decision.region_id && <Text style={s.meta}>A decisão usa um recorte OCR preservado na página {decision.page}. Copie o trecho literal do texto dessa região.</Text>}
        <Text selectable style={s.body}>{page.text}</Text>
        <View style={s.buttonRow}>
          <Pressable accessibilityRole="button" disabled={busy || page.page_number === 1} onPress={() => viewPage(page.page_number - 1)}><Text style={s.secondaryButtonText}>Página anterior</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy || page.page_number === d.pages.length} onPress={() => viewPage(page.page_number + 1)}><Text style={s.secondaryButtonText}>Próxima página</Text></Pressable>
        </View>
        <Text style={s.meta}>Página da evidência: {decision.page ?? page.page_number}. Ler outras páginas preserva o trecho escolhido.</Text>
        {decision.page != null && decision.page !== page.page_number && <View style={s.buttonRow}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => viewPage(decision.page!)}><Text style={s.secondaryButtonText}>Voltar à página da evidência</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => update(hash, { page: page.page_number, snippet: '', region_id: null })}><Text style={s.secondaryButtonText}>Substituir trecho por evidência da página atual</Text></Pressable>
        </View>}
        <TextInput accessibilityLabel={`Trecho que sustenta a decisão: ${d.document.title}`} multiline style={s.body} placeholder="Copie um trecho literal que sustenta sua decisão" value={decision.snippet ?? ''} editable={!busy} onChangeText={snippet => update(hash, { snippet, page: decision.page ?? page.page_number })} />
        <TextInput accessibilityLabel={`Efeito do documento: ${d.document.title}`} multiline style={s.body} placeholder="Explique o efeito e os dados conferidos" value={decision.reason ?? ''} editable={!busy} onChangeText={reason => update(hash, { reason })} />
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: decision.effect === 'reflected_in_selected_document' }} disabled={busy} onPress={() => update(hash, { effect: 'reflected_in_selected_document' })}><Text style={s.secondaryButtonText}>{decision.effect === 'reflected_in_selected_document' ? '✓ ' : ''}Alterações já incorporadas no edital selecionado</Text></Pressable>
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: decision.effect === 'no_field_change' }} disabled={busy} onPress={() => update(hash, { effect: 'no_field_change' })}><Text style={s.secondaryButtonText}>{decision.effect === 'no_field_change' ? '✓ ' : ''}Não altera os dados extraídos</Text></Pressable>
      </View>;
    })}
    {!!review && <Pressable accessibilityRole="button" disabled={busy || !ready} style={s.secondaryButton} onPress={() => execute(async () => {
      await approveDocumentEffects(runId, review, documents.map(d => decisions[d.artifact.sha256] as DocumentEffectDecision));
      await onApproved(); setReview(null);
    })}><Text style={s.secondaryButtonText}>Registrar revisão e liberar comparação dos campos</Text></Pressable>}
    {busy && <ActivityIndicator />}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}
