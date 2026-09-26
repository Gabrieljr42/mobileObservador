import type { TenderProofField, TenderProofComparisonField } from '../api/tenderproof';

// Historical observations remain intact; document unreadability is enough to
// explain missing values without claiming the source omitted the information.
export function extractionPendingReason(validation: string, field: TenderProofField | undefined,
  comparison: TenderProofComparisonField): string | null {
  const state = field?.state ?? comparison.tenderproof_state;
  if (state==='supported' || state==='conflict') return null;
  if (state==='failed') return field?.reason || 'Extração pendente; não foi possível determinar o valor deste campo.';
  if (validation==='unreadable' && comparison.tenderproof_value==null) {
    return 'O documento não forneceu texto para a extração inicial. Confira o processamento e os recortes OCR preparados abaixo. Isso não significa que a informação esteja ausente no PDF.';
  }
  return null;
}
