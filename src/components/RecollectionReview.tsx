import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { getTenderProofContinuousStatus, getTenderProofRecollection, requestTenderProofRecollection,
  TenderProofRecollection, TenderProofRun } from '../api/tenderproof';
import { useAppTheme } from '../theme';

const pending = (value: TenderProofRecollection | null) => value && ['queued', 'retry', 'running', 'recover'].includes(value.status);
const labels: Record<string, string> = { queued: 'Na fila', retry: 'Aguardando nova tentativa',
  running: 'Consultando a fonte', recover: 'Recuperando o processamento', succeeded: 'Nova coleta concluída',
  failed: 'Não foi possível concluir', deferred: 'Prazo do ciclo encerrado', cancelled: 'Coleta cancelada' };

export function RecollectionReview({ run, onOpen }: { run: TenderProofRun; onOpen: (id: string) => void }) {
  const theme = useAppTheme();
  const [job, setJob] = useState<TenderProofRecollection | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let stopped = false;
    Promise.all([getTenderProofContinuousStatus(), getTenderProofRecollection(run.run_id)])
      .then(([status, saved]) => { if (!stopped) {
        setAllowed(status.operationally_enabled && status.operator_authorized && status.sources.some(s => s.source === run.source && s.enabled && s.mode === run.mode));
        setJob(saved);
      } }).catch(() => { if (!stopped) setError('Não foi possível consultar a renovação. Reabra esta coleta para tentar novamente.'); });
    return () => { stopped = true; };
  }, [run.run_id, run.source, run.mode]);
  useEffect(() => {
    if (!pending(job)) return;
    let stopped = false;
    let inFlight = false;
    const timer = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const next = await getTenderProofRecollection(run.run_id);
        if (!stopped) { setJob(next); setError(''); }
      } catch { if (!stopped) setError('A consulta ao andamento falhou; tentaremos novamente.'); }
      finally { inFlight = false; }
    }, 10000);
    return () => { stopped = true; clearInterval(timer); };
  }, [run.run_id, job?.status]);
  async function request() {
    setBusy(true); setError('');
    try { setJob(await requestTenderProofRecollection(run.run_id)); }
    catch (e: any) { setError(e?.response?.data?.detail ?? 'Não foi possível confirmar o pedido. Tente novamente; o mesmo pedido não duplica a coleta.'); }
    finally { setBusy(false); }
  }
  if (!run.selected_candidate_id || !['completed', 'failed'].includes(run.execution_status)) return null;
  return <View style={{ padding: 14, gap: 10 }}>
    <Text style={{ color: theme.colors.text, fontWeight: 'bold' }}>Consultar novamente a fonte</Text>
    <Text style={{ color: theme.colors.text }}>Cria uma nova coleta deste concurso e preserva os documentos e a conferência anteriores. O resultado precisará de revisão antes de publicar.</Text>
    {run.coverage?.parent_run_id && <Pressable accessibilityRole="button" onPress={() => onOpen(run.coverage!.parent_run_id!)}>
      <Text style={{ color: theme.colors.text, textDecorationLine: 'underline' }}>Consultar coleta anterior preservada</Text>
    </Pressable>}
    {!job && allowed && <Pressable accessibilityRole="button" disabled={busy} onPress={request}>
      <Text style={{ color: theme.colors.text, textDecorationLine: 'underline' }}>{busy ? 'Registrando pedido…' : 'Solicitar nova coleta'}</Text>
    </Pressable>}
    {!job && !allowed && <Text style={{ color: theme.colors.text }}>A renovação exige a fonte habilitada e acesso de operação.</Text>}
    {job && <Text style={{ color: theme.colors.text }}>{labels[job.status] ?? 'Coleta encerrada'}{job.error === 'acquisition_busy' ? ' · Aguardando a coleta em andamento liberar capacidade' : ''}</Text>}
    {job?.run_id && !pending(job) && <Pressable accessibilityRole="button" onPress={() => onOpen(job.run_id!)}>
      <Text style={{ color: theme.colors.text, textDecorationLine: 'underline' }}>Abrir nova coleta para conferência</Text>
    </Pressable>}
    {!!error && <Text accessibilityRole="alert" style={{ color: theme.colors.text }}>{error}</Text>}
  </View>;
}

