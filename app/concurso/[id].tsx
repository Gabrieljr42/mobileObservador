import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchConcursoById, getDemoConcursoById } from '../../src/api/client';
import { getConcursoPublications, ConcursoPublication } from '../../src/api/publications';
import { getConcursoVersions, ConcursoVersion } from '../../src/api/updates';
import { Concurso } from '../../src/types/concurso';
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

export default function ConcursoDetalhe() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [concurso, setConcurso] = useState<Concurso | null>(null);
  const [publications, setPublications] = useState<ConcursoPublication[]>([]);
  const [versions, setVersions] = useState<ConcursoVersion[]>([]);
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
  }, [id]);

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

  const openLink = (url?: string | null) => {
    if (url) Linking.openURL(url);
    else alert('Link indisponível');
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
        <View style={styles.header}>
           <View style={styles.badges}>
             <StatusBadge status={concurso.status} />
           </View>
           <Text style={styles.title}>{concurso.titulo}</Text>
           <Text style={styles.orgao}><MaterialIcons name="account-balance" size={14} /> {concurso.orgao}</Text>
        </View>

        <View style={styles.bentoGrid}>
          <View style={styles.bentoItem}>
             <Text style={styles.bentoLabel}>CARGO</Text>
             <Text style={styles.bentoValue}>{concurso.cargo || 'N/I'}</Text>
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

        <View style={styles.actions}>
           <Pressable style={styles.mainAction} onPress={() => openLink(concurso.link_inscricao)}>
             <Text style={styles.mainActionText}>Inscrição no Edital</Text>
             <MaterialIcons name="open-in-new" size={18} color={theme.colors.onTertiaryContainer} />
           </Pressable>
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
                <Text style={styles.timelineValue}>{concurso.inscricao_inicio} a {concurso.inscricao_fim}</Text>
             </View>
             <View style={styles.timelineItem}>
                <Text style={styles.timelineLabel}>DATA DA PROVA</Text>
                <Text style={styles.timelineValue}>{concurso.edital_data || 'N/I'}</Text>
             </View>
          </View>
        </View>

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
              <TextInput
                style={styles.modalInput}
                value={alertName}
                onChangeText={setAlertName}
                placeholder="Ex: Concurso da Prefeitura"
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
  timeline: { paddingLeft: 8 },
  timelineItem: { paddingLeft: 16, borderLeftWidth: 2, borderLeftColor: theme.colors.surfaceHighest, paddingBottom: 16 },
  timelineLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.tertiaryContainer, letterSpacing: 1, marginBottom: 4 },
  timelineValue: { fontSize: 14, fontWeight: 'bold', color: theme.colors.primary },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContentWrapper: { width: '100%' },
  modalContent: { backgroundColor: theme.colors.surfaceLowest, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.primary },
  modalDesc: { fontSize: 14, color: theme.colors.mutedText, marginBottom: 24, lineHeight: 20 },
  inputLabel: { fontSize: 12, fontWeight: 'bold', color: theme.colors.mutedText, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  modalInput: { backgroundColor: theme.colors.surfaceHighest, padding: 16, borderRadius: 12, fontSize: 16, color: theme.colors.text, marginBottom: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancelBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, backgroundColor: theme.colors.surfaceHighest },
  modalCancelText: { color: theme.colors.text, fontWeight: 'bold' },
  modalSaveBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', minWidth: 100 },
  modalSaveText: { color: theme.colors.surfaceLowest, fontWeight: 'bold' }
});
