import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { prepareOCRRegion, compareRegistrationTargets, RegistrationTargetComparison, DocumentEffectCase, OCRRegion } from '../api/tenderproof';

type Props = { runId: string; review: DocumentEffectCase; artifactId: string; pageNumber: number;
  selected?: OCRRegion; disabled: boolean; styles: any; onCreated: (region: OCRRegion) => void; onUse: (region: OCRRegion) => void };

export function OCRRegionReview({ runId, review, artifactId, pageNumber, selected, disabled, styles: s, onCreated, onUse }: Props) {
  const documentHash = review.documents.find(d=>d.artifact.artifact_id===artifactId)?.artifact.sha256;
  const preservedRegions = (review.ocr_regions ?? []).filter(r=>r.document_sha256===documentHash && r.page_number===pageNumber);
  const initialRegion = selected ?? preservedRegions[preservedRegions.length-1];
  const [bounds, setBounds] = useState(initialRegion?.bounds.map(v=>String(v/100)) ?? ['0','0','50','100']);
  const [region, setRegion] = useState<OCRRegion | undefined>(initialRegion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState<RegistrationTargetComparison>();
  const labels = ['Margem esquerda (%)','Início vertical (%)','Margem direita (%)','Fim vertical (%)'];
  const fieldLabels: Record<string,string> = { titulo:'Título',orgao:'Órgão',edital_numero:'Número do edital',inscricao_inicio:'Início das inscrições',inscricao_fim:'Fim das inscrições',prova_data:'Data da prova',cargos:'Cargos',remuneracao:'Remuneração' };
  const numbers = bounds.map(v => v.trim() ? Number(v.replace(',','.')) : NaN);
  const valid = numbers.every(v => Number.isFinite(v) && v>=0 && v<=100) && numbers[0]<numbers[2] && numbers[1]<numbers[3];
  const date = (value: string) => value.split('-').reverse().join('/');
  return <View style={s.fieldBox}>
    <Text style={s.fieldName}>Separar coluna ou ato nesta página</Text>
    <Text style={s.body}>Use o PDF oficial como referência. Os limites vão de 0 a 100% da largura e da altura. Ajuste também o início e o fim vertical para incluir somente o ato do órgão e do cargo conferidos.</Text>
    {preservedRegions.length>1 && <View style={s.buttonRow}>{preservedRegions.map((saved,i) =>
      <Pressable key={saved.id} accessibilityRole="button" disabled={disabled || busy} onPress={()=>{
        setRegion(saved); setBounds(saved.bounds.map(v=>String(v/100))); setComparison(undefined); setError('');
      }}><Text style={s.secondaryButtonText}>Recorte preservado {i+1}{saved.preview_role_details ? ` · ${saved.preview_role_details.nome}` : saved.preview_vacancies ? ' · quadro de vagas' : ''}</Text></Pressable>
    )}</View>}
    <View style={s.buttonRow}>
      {[['Coluna esquerda','0','50'],['Coluna direita','50','100'],['Largura inteira','0','100']].map(([label,left,right]) =>
        <Pressable key={label} accessibilityRole="button" disabled={disabled || busy} onPress={() => setBounds([left,bounds[1],right,bounds[3]])}><Text style={s.secondaryButtonText}>{label}</Text></Pressable>)}
    </View>
    {labels.map((label,i) => <View key={label}>
      <Text style={s.meta}>{label}</Text>
      <TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={bounds[i]} style={s.body} editable={!disabled && !busy}
        onChangeText={value => setBounds(prior => prior.map((v,j) => i===j ? value : v))} />
    </View>)}
    <Pressable accessibilityRole="button" disabled={disabled || busy || !valid} onPress={async () => {
      setBusy(true); setError(''); setComparison(undefined);
      try { const value = await prepareOCRRegion(runId,review,artifactId,pageNumber,numbers.map(v=>Math.round(v*100))); setRegion(value); onCreated(value); }
      catch (e: any) { setError(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'Não foi possível preparar a região. Ajuste os limites e tente novamente.'); }
      finally { setBusy(false); }
    }}><Text style={s.secondaryButtonText}>{busy ? 'Separando palavras…' : 'Conferir região do OCR'}</Text></Pressable>
    {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
    {!!region && <View style={s.fieldBox}>
      <Text style={s.fieldName}>Texto da região · página física {region.page_number}</Text>
      <Text style={s.meta}>{region.word_indices.length} palavras · limites {region.bounds.map(v=>v/100).join(' / ')}% · {region.method_version}</Text>
      {!!region.boundary_words_excluded && <Text style={s.body}>{region.boundary_words_excluded} palavras cortadas pelo limite foram excluídas. Amplie o recorte se fizerem parte do ato.</Text>}
      <Text selectable style={s.body}>{region.text}</Text>
      {!!region.preview_role_details && <View style={s.fieldBox}>
        <Text style={s.fieldName}>Remuneração e requisitos · {region.preview_role_details.nome}</Text>
        <Text style={s.body}>Remuneração: {new Intl.NumberFormat('pt-BR',{style:'currency',currency:region.preview_role_details.moeda}).format(Number(region.preview_role_details.remuneracao))} · {region.preview_role_details.jornada}</Text>
        <Text selectable style={s.body}>{region.preview_role_details.requisitos}</Text>
        <Text style={s.body}>{region.preview_role_details.association_status==='matched'
          ? 'Nome e jornada correspondem à função no quadro de vagas deste PDF. Confira ambos os trechos antes de aprovar.'
          : region.preview_role_details.association_status==='conflicting_vacancy_row'
          ? 'Há divergência com o quadro de vagas. A associação exige revisão.'
          : 'Prepare também o recorte do quadro de vagas para conferir a associação desta função.'}</Text>
        <Text style={s.meta}>Dados reconhecidos por OCR, ainda sujeitos à conferência. Nenhum valor foi publicado.</Text>
      </View>}
      {!!region.preview_vacancies && <View style={s.fieldBox}>
        <Text style={s.fieldName}>Quadro de vagas · conferir com o PDF</Text>
        <Text style={s.body}>{region.preview_vacancies.rows.length} funções · {region.preview_vacancies.total_vagas} vagas no total, incluindo {region.preview_vacancies.total_pcd} para pessoas com deficiência.</Text>
        <Text style={s.body}>{region.preview_vacancies.notice}</Text>
        {region.preview_vacancies.rows.map((cargo,i) => <View key={i} style={s.fieldBox}>
          <Text style={s.fieldName}>{cargo.nome}</Text>
          <Text style={s.body}>{cargo.cidade ?? 'Cidade: extração pendente'} · {cargo.jornada}</Text>
          <Text style={s.body}>{cargo.vagas_imediatas} vaga(s) no total · ampla concorrência: {cargo.vagas_ampla_concorrencia} · pessoas com deficiência: {cargo.vagas_pcd ?? 'conferência pendente'}.</Text>
        </View>)}
        <Text style={s.meta}>A reserva para pessoas com deficiência faz parte do total de vagas. Ela não indica cadastro de reserva. Estes cargos ainda não foram publicados.</Text>
      </View>}
      {region.preview_effects?.map((effect,i) => <View key={i} style={s.fieldBox}>
        <Text style={s.fieldName}>Reabertura identificada · conferir antes de aplicar</Text>
        <Text style={s.body}>Exclusivamente para {effect.scope.name}.</Text>
        <Text style={s.body}>Inscrições anteriores anuladas: de {date(effect.annulled_period.start)} a {date(effect.annulled_period.end)}.</Text>
        <Text style={s.body}>Novo período: de {date(effect.new_period.start)} a {date(effect.new_period.end)}, até {effect.new_period.end_time}.</Text>
        <Text style={s.meta}>Portaria {effect.act.issuer} {effect.act.number}, de {date(effect.act.date)}. Referência à Portaria {effect.original_act.number}, de {date(effect.original_act.date)}.</Text>
        <Text style={s.body}>Esta alteração não define o prazo dos demais cargos. A associação ao cargo e sua aplicação ao catálogo continuam pendentes.</Text>
      </View>)}
      {!!region.preview_effects?.length && <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={async () => {
        setBusy(true); setError(''); setComparison(undefined);
        try { setComparison(await compareRegistrationTargets(runId,review,region.id)); }
        catch (e: any) { setError(typeof e?.response?.data?.detail === 'string' ? e.response.data.detail : 'Não foi possível comparar com o catálogo. Tente novamente.'); }
        finally { setBusy(false); }
      }}><Text style={s.secondaryButtonText}>Conferir cargo no catálogo</Text></Pressable>}
      {!!comparison && <View style={s.fieldBox}>
        <Text style={s.fieldName}>Comparação com o catálogo</Text>
        {!!comparison.title && <Text style={s.body}>{comparison.title}</Text>}
        {!!comparison.message && <Text style={s.body}>{comparison.message}</Text>}
        {comparison.comparisons?.map((item,i) => <View key={i}>
          {!!item.cargo_name && <Text style={s.fieldName}>{item.cargo_name}</Text>}
          <Text style={s.body}>{item.message}</Text>
          {!!item.proposed_registration && <Text style={s.body}>Período proposto somente para este cargo: {date(item.proposed_registration.start)} a {date(item.proposed_registration.end)}, até {item.proposed_registration.end_time}.</Text>}
        </View>)}
        <Text style={s.meta}>Consulta sem alteração de dados. A aprovação e a aplicação permanecem pendentes.</Text>
      </View>}
      <Text style={s.body}>Dados sugeridos pelo recorte ainda precisam de conferência do órgão, do cargo e do efeito da retificação. Eles não foram aplicados ao catálogo.</Text>
      {!region.preview_fields.some(f=>f.value!=null) && !region.preview_effects?.length && !region.preview_vacancies && !region.preview_role_details && <Text style={s.body}>Nenhum campo estruturado foi extraído deste recorte. A interpretação permanece pendente, mesmo quando o dado pode ser lido no texto acima.</Text>}
      {region.preview_fields.filter(f=>f.value!=null).map(f => <Text key={f.field_name} selectable style={s.body}>{fieldLabels[f.field_name] ?? f.field_name}: {typeof f.value==='string' ? f.value : JSON.stringify(f.value)}</Text>)}
      <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={() => onUse(region)}><Text style={s.secondaryButtonText}>Usar esta região na decisão</Text></Pressable>
    </View>}
  </View>;
}
