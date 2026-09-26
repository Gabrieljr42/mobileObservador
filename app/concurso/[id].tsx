import { useSyncRevision } from '../../src/sync/revision';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchConcursoById, fetchConcursoReviewStatus, getDemoConcursoById } from '../../src/api/client';
import { getConcursoPublications, ConcursoPublication } from '../../src/api/publications';
import { getConcursoVersions, ConcursoVersion } from '../../src/api/updates';
import { Concurso, ConcursoReviewStatus } from '../../src/types/concurso';
import { getFavorites, addFavorite, removeFavorite } from '../../src/api/favorites';
import { createAlert } from '../../src/api/alerts';
import { useAppTheme } from '../../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { StatusBadge } from '../../src/components/StatusBadge';
import { PublicationCard } from '../../src/components/PublicationCard';
import { TimelineItem } from '../../src/components/TimelineItem';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/providers/AuthProvider';
import { formatDate, formatTemporal, formatPublishedTemporal, formatAmendmentEvent, formatChangedValue, workloadChanges } from '../../src/utils/formatters';
import { beneficiosCargo, resumoCargo } from '../../src/utils/cargos';
import { registrationSituation } from '../../src/utils/registrationStatus';
import { concursoActionLinks } from '../../src/utils/officialLinks';

type JsonRecord = Record<string, any>;

const asRecord = (value: unknown): JsonRecord | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
);

const amendmentHistory = (rawData: Concurso['raw_data']): JsonRecord[] => {
  const root = asRecord(rawData)?.tenderproof;
  const records = asRecord(root)?.amendments;
  return Array.isArray(records) ? records.map(asRecord).filter((value): value is JsonRecord => !!value) : [];
};

const amendmentFieldLabels: Record<string, string> = {
  etapas_prova: 'Etapas da prova',
  resultado_final_prazo: 'Prazo do resultado final',
  entrega_titulos_prazo: 'Prazo da entrega de títulos',
  inscricao_inicio: 'Início das inscrições',
  inscricao_fim: 'Fim das inscrições',
  prova_data: 'Data da prova',
};

const amendmentEventLabels: Record<string, string> = {
  etapasprova: 'Etapas da prova',
  etapas: 'Etapas da prova',
  prova: 'Etapas da prova',
  resultadofinalprazo: 'Prazo do resultado final',
  resultadofinal: 'Prazo do resultado final',
  entregatitulosprazo: 'Prazo da entrega de títulos',
  entregatitulo: 'Prazo da entrega de títulos',
  titulosprazo: 'Prazo da entrega de títulos',
};

const amendmentChanges = (amendment: JsonRecord): JsonRecord[] => {
  const raw = amendment.changes;
  if (Array.isArray(raw)) {
    return raw.map(asRecord).filter((value): value is JsonRecord => !!value);
  }
  const changeMap = asRecord(raw);
  if (!changeMap) return [];
  return Object.entries(changeMap).map(([fieldName, value]) => {
    const change = asRecord(value);
    return { ...(change || { new: value }), field_name: change?.field_name || fieldName };
  });
};

const amendmentEventLabel = (event: JsonRecord): string => {
  const raw = String(event.label || event.name || event.kind || 'Evento');
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return amendmentEventLabels[normalized] || raw;
};

const periodText = (period: JsonRecord) => {
  const timezone = period.timezone || null;
  const precision = period.precision === 'day' ? 'day' : 'instant';
  const start = period.start ? formatTemporal(period.start, timezone, period.start_precision || precision) : 'Data não informada';
  const end = period.end ? formatTemporal(period.end, timezone, period.end_precision || precision) : 'sem fim informado';
  return `${start} a ${end}`;
};

const evidenceText = (amendment: JsonRecord, event?: JsonRecord) => {
  const rawEvidence = event?.evidence || event?.provenance || amendment.evidence || amendment.provenance;
  const evidence = Array.isArray(rawEvidence) ? asRecord(rawEvidence[0]) : asRecord(rawEvidence);
  const document = asRecord(amendment.amendment_document);
  const sha = evidence?.sha256 || evidence?.document_sha256 || document?.sha256 || amendment.amendment_document_sha256;
  const page = evidence?.page || evidence?.page_number;
  if (!sha && !page) return null;
  return `Evidência: ${sha ? `SHA-256 ${sha}` : ''}${sha && page ? ' · ' : ''}${page ? `página ${page}` : ''}`;
};

export default function ConcursoDetalhe() {
  const syncRevision = useSyncRevision();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [concurso, setConcurso] = useState<Concurso | null>(null);
  const [publications, setPublications] = useState<ConcursoPublication[]>([]);
  const [versions, setVersions] = useState<ConcursoVersion[]>([]);
  const [reviewStatus, setReviewStatus] = useState<ConcursoReviewStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);

  // Alert Dialog State
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertName, setAlertName] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);

  useEffect(() => {
    if (id) {
      loadData(false);
    }
  }, [id, syncRevision]);

  useEffect(() => {
    let cancelled = false;
    setReviewStatus(null);
    if (id) {
      fetchConcursoReviewStatus(Number(id))
        .then(status => { if (!cancelled) setReviewStatus(status); })
        .catch(() => {
          if (!cancelled) setReviewStatus({ pending: false, unavailable: true,
            reason: 'Não foi possível conferir documentos novos. As datas exibidas pertencem à última versão sincronizada.' });
        });
    }
    return () => { cancelled = true; };
  }, [id, syncRevision]);

  const loadData = async (useDemo = false) => {
    if (!id) return;
    const concursoId = Number(id);
    setLoading(true);
    setError(null);
    try {
      if (useDemo) {
        const data = getDemoConcursoById(concursoId);
        setConcurso(data);
        setPublications([]);
        setVersions([]);
        setReviewStatus(null);
      } else {
        const data = await fetchConcursoById(concursoId);
        setConcurso(data);
        try {
          const [pubs, vers] = await Promise.all([
            getConcursoPublications(concursoId),
            getConcursoVersions(concursoId)
          ]);
          setPublications(pubs);
          setVersions(vers);
        } catch (e) {
          console.warn("Failed to load versions/publications", e);
        }
      }
      const favs = await getFavorites();
      const isFav = favs.some(f => f.id === concursoId);
      setFavorite(isFav);
    } catch (e: any) {
      setError(e.message || "Failed to load details");
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    if (!concurso) return;
    try {
      if (favorite) {
        await removeFavorite(concurso.id);
        setFavorite(false);
      } else {
        await addFavorite(concurso.id);
        setFavorite(true);
      }
    } catch (error) {
      console.warn("Failed to toggle favorite");
    }
  };

  const handleAlertClick = () => {
    if (!user) {
      Alert.alert('Acesso Negado', 'Você precisa estar logado para criar alertas.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Fazer Login', onPress: () => router.push('/login') }
      ]);
      return;
    }
    if (concurso) {
      setAlertName(`Alerta para ${concurso.titulo}`);
      setShowAlertModal(true);
    }
  };

  const handleSaveAlert = async () => {
    if (!concurso) return;
    if (!alertName.trim()) {
      Alert.alert('Erro', 'Por favor, insira um nome para o alerta.');
      return;
    }
    setSavingAlert(true);
    try {
      await createAlert({
        name: alertName,
        uf: concurso.uf || '',
        cidade: concurso.cidade || '',
        banca: concurso.banca || '',
        area: "assistencia_social", // Or derive from concurso.area if available
        cargo_keyword: concurso.cargo || concurso.titulo,
        only_open: false,
        active: true
      });
      setShowAlertModal(false);
      Alert.alert('Sucesso', 'Alerta criado com sucesso!', [
        { text: 'Ir para Alertas', onPress: () => router.push('/alertas') },
        { text: 'OK', style: 'cancel' }
      ]);
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível criar o alerta. Tente novamente.');
    } finally {
      setSavingAlert(false);
    }
  };

  const openLink = async (url?: string | null) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link indisponível', 'Não foi possível abrir a página oficial.');
    }
  };

  if (loading) {
    return <View style={styles.center}><LoadingState message="Carregando detalhes..." /></View>;
  }

  if (error || !concurso) {
    return (
      <View style={styles.center}>
        <ErrorState message={error || "Concurso não encontrado"} onRetry={() => loadData(false)} onDemo={() => loadData(true)} />
      </View>
    );
  }

  const amendments = amendmentHistory(concurso.raw_data);
  const actionLinks = concursoActionLinks(concurso);

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <Pressable onPress={() => router.back()} style={styles.appBarBtn}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.appBarTitle}>Detalhe</Text>
        <View style={styles.appBarActions}>
          <Pressable style={styles.appBarBtn}><MaterialIcons name="share" size={24} color={theme.colors.mutedText} /></Pressable>
        </View>

      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]}>
        {(reviewStatus?.pending || reviewStatus?.unavailable) && <View style={styles.reviewWarning}>
          <MaterialIcons name="fact-check" size={20} color={theme.colors.error} />
          <View style={styles.reviewWarningBody}>
            <Text style={styles.reviewWarningTitle}>{reviewStatus.unavailable ? 'Conferência indisponível' : 'Pendente de conferência'}</Text>
            <Text style={styles.reviewWarningText}>{reviewStatus.reason || 'Há documentos novos aguardando conferência. As datas abaixo são da última versão aprovada e podem ter mudado.'}</Text>
          </View>
        </View>}
        <View style={styles.header}>
           <View style={styles.badges}>
             <StatusBadge status={concurso.status} situation={registrationSituation(concurso)} />
           </View>
           <Text style={styles.title}>{concurso.titulo}</Text>
           <Text style={styles.orgao}><MaterialIcons name="account-balance" size={14} /> {concurso.orgao}</Text>
        </View>

        <View style={styles.bentoGrid}>
          <View style={styles.bentoItem}>
             <Text style={styles.bentoLabel}>CARGO</Text>
             <Text style={styles.bentoValue}>{concurso.cargos?.map(c => c.nome).join(', ') || concurso.cargo || 'Pendente de conferência'}</Text>
          </View>
          <View style={styles.bentoItem}>
             <Text style={styles.bentoLabel}>CIDADE</Text>
             <Text style={styles.bentoValue}>{concurso.cidade || concurso.uf || 'N/I'}</Text>
          </View>
          <View style={styles.bentoItem}>
             <Text style={styles.bentoLabel}>BANCA</Text>
             <Text style={styles.bentoValue}>{concurso.banca || 'N/I'}</Text>
          </View>
        </View>

        {!!concurso.cargos?.length && <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cargos e requisitos</Text>
          {concurso.cargos.map((cargo, index) => {
            const beneficios = beneficiosCargo(cargo);
            return <View key={`${cargo.nome}-${index}`} style={styles.timelineItem}>
              <Text selectable style={styles.timelineValue}>{resumoCargo(cargo)}</Text>
              {beneficios.length > 0 && <View style={styles.benefitsBox} accessible accessibilityLabel={`Benefícios: ${beneficios.join(', ')}`}>
                <Text style={styles.benefitsLabel}>Benefícios:</Text>
                {beneficios.map((beneficio, beneficioIndex) => (
                  <Text key={`${beneficio}-${beneficioIndex}`} selectable style={styles.benefitValue}>• {beneficio}</Text>
                ))}
              </View>}
            </View>;
          })}
        </View>}

         <View style={styles.actions}>
            {actionLinks.primary && <Pressable style={styles.mainAction} onPress={() => { void openLink(actionLinks.primary?.url); }}>
              <Text style={styles.mainActionText}>{actionLinks.primary.label}</Text>
              <MaterialIcons name="open-in-new" size={18} color={theme.colors.onTertiaryContainer} />
            </Pressable>}
            {actionLinks.edital && <Pressable style={styles.editalAction} onPress={() => { void openLink(actionLinks.edital?.url); }}>
              <Text style={styles.editalActionText}>{actionLinks.edital.label}</Text>
              <MaterialIcons name="description" size={18} color={theme.colors.primary} />
            </Pressable>}
           <View style={styles.actionGrid}>
             <Pressable style={[styles.gridAction, favorite && styles.gridActionActive]} onPress={toggleFavorite}>
               <MaterialIcons name={favorite ? "bookmark" : "bookmark-border"} size={24} color={favorite ? theme.colors.surfaceLowest : theme.colors.primary} />
               <Text style={[styles.gridActionText, favorite && styles.gridActionTextActive]}>{favorite ? 'SALVO' : 'SALVAR'}</Text>
             </Pressable>
             <Pressable style={styles.gridAction} onPress={handleAlertClick}>
               <MaterialIcons name="notifications-active" size={24} color={theme.colors.primary} />
               <Text style={styles.gridActionText}>ALERTAR</Text>
             </Pressable>
           </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
             <View style={styles.sectionIcon}>
               <MaterialIcons name="calendar-month" size={20} color={theme.colors.onSecondaryContainer} />
             </View>
             <Text style={styles.sectionTitle}>Cronograma</Text>
          </View>
          <View style={styles.timeline}>
             <View style={styles.timelineItem}>
                <Text style={styles.timelineLabel}>INSCRIÇÕES</Text>
                <Text style={styles.timelineValue}>{formatPublishedTemporal(concurso.inscricao_inicio, concurso.raw_data, 'inscricao_inicio')} a {formatPublishedTemporal(concurso.inscricao_fim, concurso.raw_data, 'inscricao_fim')}</Text>
             </View>
             <View style={styles.timelineItem}>
                <Text style={styles.timelineLabel}>DATA DA PROVA</Text>
                <Text style={styles.timelineValue}>{concurso.prova_data ? formatPublishedTemporal(concurso.prova_data, concurso.raw_data, 'prova_data') : 'Pendente de conferência'}</Text>
             </View>
          </View>
        </View>

        {amendments.length > 0 && <View style={[styles.section, { marginTop: 24 }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <MaterialIcons name="update" size={20} color={theme.colors.onSecondaryContainer} />
            </View>
            <Text style={styles.sectionTitle}>Períodos e eventos de retificação</Text>
          </View>
          {amendments.map((amendment, index) => {
            const periods = asRecord(amendment.periods);
            const original = asRecord(periods?.original);
            const current = asRecord(periods?.current);
            const reopenings = Array.isArray(periods?.reopenings)
              ? periods.reopenings.map(asRecord).filter((value): value is JsonRecord => !!value)
              : [];
            const events = Array.isArray(amendment.events)
              ? amendment.events.map(asRecord).filter((value): value is JsonRecord => !!value)
              : [];
            const changes = amendmentChanges(amendment);
            const amendmentDocument = asRecord(amendment.amendment_document);
            const amendmentUrl = amendmentDocument?.url || amendment.amendment_document_url || amendment.url;
            return (
              <View key={`${amendment.proposal_id || amendment.amendment_document_sha256 || index}`} style={styles.amendmentBox}>
                <Text style={styles.amendmentTitle}>{amendment.title || `Retificação ${index + 1}`}</Text>
                {!!(amendmentDocument?.title || amendmentUrl || amendmentDocument?.sha256 || amendment.amendment_document_sha256) && (
                  <Pressable
                    disabled={!amendmentUrl}
                    onPress={() => openLink(amendmentUrl)}
                    accessibilityRole={amendmentUrl ? 'link' : undefined}
                  >
                    <Text style={[styles.amendmentMeta, amendmentUrl && styles.documentLink]}>
                      Documento retificador: {amendmentDocument?.title || amendmentUrl || `SHA-256 ${amendment.amendment_document_sha256 || 'não informado'}`}
                    </Text>
                  </Pressable>
                )}
                {original && <Text style={styles.timelineValue}>Período original: {periodText(original)}</Text>}
                {current && <Text style={styles.timelineValue}>Período vigente: {periodText(current)}</Text>}
                {reopenings.map((reopening, reopeningIndex) => (
                  <Text key={`reopening-${reopeningIndex}`} style={styles.timelineValue}>
                    Reabertura {reopeningIndex + 1}: {periodText(reopening)}
                  </Text>
                ))}
                {changes.map((change, changeIndex) => {
                  const fieldName = String(change.field_name || change.name || `campo_${changeIndex + 1}`);
                  const previous = Object.prototype.hasOwnProperty.call(change, 'previous')
                    ? change.previous
                    : change.old;
                  const next = Object.prototype.hasOwnProperty.call(change, 'new')
                    ? change.new
                    : change.current;
                  const workloads = fieldName === 'cargos' ? workloadChanges(previous, next) : null;
                  if (workloads) return workloads.map((item, index) => (
                    <View key={`workload-${changeIndex}-${index}`} style={styles.amendmentChange}>
                      <Text style={styles.amendmentEventLabel}>{item.name} · {item.field === 'remuneracao' ? 'Remuneração' : 'Jornada'}</Text>
                      <Text style={styles.amendmentChangeValue}>Anterior: {item.previous}</Text>
                      <Text style={styles.amendmentChangeValue}>Vigente: {item.current}</Text>
                      {!!change.reason && <Text style={styles.amendmentMeta}>Motivo: {change.reason}</Text>}
                      {!!evidenceText(amendment, change) && <Text style={styles.amendmentMeta}>{evidenceText(amendment, change)}</Text>}
                    </View>
                  ));
                  return (
                    <View key={`change-${fieldName}-${changeIndex}`} style={styles.amendmentChange}>
                      <Text style={styles.amendmentEventLabel}>{change.label || amendmentFieldLabels[fieldName] || fieldName}</Text>
                      <Text style={styles.amendmentChangeValue}>
                        Anterior: {formatChangedValue(previous)}
                      </Text>
                      <Text style={styles.amendmentChangeValue}>
                        Vigente: {formatChangedValue(next)}
                      </Text>
                      {!!change.reason && <Text style={styles.amendmentMeta}>Motivo: {change.reason}</Text>}
                      {!!evidenceText(amendment, change) && <Text style={styles.amendmentMeta}>{evidenceText(amendment, change)}</Text>}
                    </View>
                  );
                })}
                {events.map((event, eventIndex) => (
                  <View key={`event-${eventIndex}`} style={styles.amendmentEvent}>
                    <Text style={styles.amendmentEventLabel}>{amendmentEventLabel(event)}</Text>
                    <Text style={styles.timelineValue}>{formatAmendmentEvent(event)}</Text>
                    {!!evidenceText(amendment, event) && <Text style={styles.amendmentMeta}>{evidenceText(amendment, event)}</Text>}
                  </View>
                ))}
                {!!evidenceText(amendment) && <Text style={styles.amendmentMeta}>{evidenceText(amendment)}</Text>}
              </View>
            );
          })}
        </View>}

        <View style={[styles.section, { marginTop: 24 }]}>
          <View style={styles.sectionHeader}>
             <View style={styles.sectionIcon}>
               <MaterialIcons name="article" size={20} color={theme.colors.onSecondaryContainer} />
             </View>
             <Text style={styles.sectionTitle}>Publicações e documentos</Text>
          </View>
          {publications.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma publicação estruturada encontrada ainda.</Text>
          ) : (
            publications.map(pub => <PublicationCard key={pub.id} pub={pub} />)
          )}
        </View>

        <View style={[styles.section, { marginTop: 24 }]}>
          <View style={styles.sectionHeader}>
             <View style={styles.sectionIcon}>
               <MaterialIcons name="history" size={20} color={theme.colors.onSecondaryContainer} />
             </View>
             <Text style={styles.sectionTitle}>Histórico de alterações</Text>
          </View>
          {versions.length === 0 ? (
            <Text style={styles.emptyText}>Sem alterações recentes.</Text>
          ) : (
            <View style={{ paddingTop: 8 }}>
              {versions.map((ver, idx) => (
                <TimelineItem key={ver.id} version={ver} isLast={idx === versions.length - 1} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CREATE ALERT MODAL */}
      <Modal visible={showAlertModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalContentWrapper}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Criar Alerta</Text>
                <Pressable onPress={() => setShowAlertModal(false)} hitSlop={10}>
                  <MaterialIcons name="close" size={24} color={theme.colors.text} />
                </Pressable>
              </View>
              <Text style={styles.modalDesc}>Esse alerta avisará você sobre andamentos deste concurso ou concursos similares.</Text>
              
              <Text style={styles.inputLabel}>Nome do alerta</Text>
              <Text style={styles.inputHint}>Escolha um nome fácil de reconhecer na tela “Meus Alertas”.</Text>
              <TextInput
                style={styles.modalInput}
                value={alertName}
                onChangeText={setAlertName}
                placeholder="Ex: Concurso da Prefeitura"
                placeholderTextColor={theme.colors.mutedText}
                accessibilityLabel="Nome do alerta"
                accessibilityHint="Digite um nome para identificar o alerta"
              />

              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancelBtn} onPress={() => setShowAlertModal(false)}>
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.modalSaveBtn} onPress={handleSaveAlert} disabled={savingAlert}>
                  {savingAlert ? <ActivityIndicator size="small" color={theme.colors.surfaceLowest} /> : <Text style={styles.modalSaveText}>Salvar</Text>}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  center: { flex: 1, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  reviewWarning: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: theme.colors.errorContainer },
  reviewWarningBody: { flex: 1 },
  reviewWarningTitle: { fontWeight: '800', color: theme.colors.error, marginBottom: 4 },
  reviewWarningText: { color: theme.colors.error, lineHeight: 19 },
  errorText: { color: theme.colors.error, fontSize: 16 },
  container: { flex: 1, backgroundColor: theme.colors.surface },
  appBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 64, paddingBottom: 16, backgroundColor: theme.colors.surfaceLowest, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 10 },
  appBarBtn: { padding: 8 },
  appBarTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.primary },
  appBarActions: { flexDirection: 'row' },
  scroll: { padding: 24, paddingBottom: 100 },
  header: { marginBottom: 32 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: theme.colors.primary, marginBottom: 8, lineHeight: 32 },
  orgao: { fontSize: 16, color: theme.colors.mutedText, fontWeight: 'bold' },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  bentoItem: { flex: 1, minWidth: '45%', backgroundColor: theme.colors.surfaceLow, padding: 16, borderRadius: 12 },
  bentoLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.mutedText, letterSpacing: 1, marginBottom: 4 },
  bentoValue: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary },
  actions: { marginBottom: 32 },
  mainAction: { backgroundColor: theme.colors.tertiaryContainer, padding: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 },
  mainActionText: { color: theme.colors.onTertiaryContainer, fontSize: 16, fontWeight: 'bold' },
  editalAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.surfaceLowest },
  editalActionText: { color: theme.colors.primary, fontWeight: '800' },
  actionGrid: { flexDirection: 'row', gap: 12 },
  gridAction: { flex: 1, backgroundColor: theme.colors.surfaceHighest, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 8 },
  gridActionActive: { backgroundColor: theme.colors.primary },
  gridActionText: { fontSize: 10, fontWeight: 'bold', color: theme.colors.primary, letterSpacing: 1 },
  gridActionTextActive: { color: theme.colors.surfaceLowest },
  section: { backgroundColor: theme.colors.surfaceLowest, padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: theme.colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary },
  emptyText: { fontSize: 14, color: theme.colors.mutedText, textAlign: 'center', marginVertical: 16 },
  amendmentBox: { borderTopWidth: 1, borderTopColor: theme.colors.surfaceHighest, paddingTop: 14, marginTop: 14 },
  amendmentTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.primary, marginBottom: 8 },
  amendmentChange: { marginTop: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: theme.colors.secondaryContainer },
  amendmentChangeValue: { fontSize: 14, color: theme.colors.primary, marginTop: 3 },
  amendmentEvent: { marginTop: 10 },
  amendmentEventLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.tertiaryContainer, textTransform: 'uppercase', letterSpacing: 0.6 },
  amendmentMeta: { fontSize: 11, color: theme.colors.mutedText, marginTop: 4 },
  documentLink: { color: theme.colors.primary, textDecorationLine: 'underline' },
  timeline: { paddingLeft: 8 },
  timelineItem: { paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: theme.colors.surfaceHighest, paddingBottom: 16 },
  timelineLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.tertiaryContainer, letterSpacing: 1, marginBottom: 4 },
  timelineValue: { fontSize: 14, fontWeight: 'bold', color: theme.colors.primary },
  benefitsBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.surfaceHighest },
  benefitsLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.primary, marginBottom: 4 },
  benefitValue: { fontSize: 14, color: theme.colors.primary, lineHeight: 21 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContentWrapper: { width: '100%' },
  modalContent: { backgroundColor: theme.colors.surfaceLowest, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.primary },
  modalDesc: { fontSize: 14, color: theme.colors.mutedText, marginBottom: 24, lineHeight: 20 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: theme.colors.mutedText, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  inputHint: { fontSize: 12, color: theme.colors.mutedText, lineHeight: 17, marginBottom: 8 },
  modalInput: { backgroundColor: theme.colors.surfaceHighest, padding: 16, borderRadius: 12, fontSize: 16, color: theme.colors.text, marginBottom: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancelBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: theme.colors.surfaceHighest },
  modalCancelText: { color: theme.colors.text, fontWeight: 'bold' },
  modalSaveBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', minWidth: 100 },
  modalSaveText: { color: theme.colors.surfaceLowest, fontWeight: 'bold' }
});
