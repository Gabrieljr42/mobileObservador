import { apiClient } from './client';

export type TenderProofMode = 'mock' | 'real';

export type TenderProofExecutionStatus =
  | 'created' | 'discovering' | 'awaiting_selection'
  | 'processing' | 'completed' | 'failed';

export type TenderProofReplayStatus = 'available' | 'pending' | 'disabled' | 'failed';

export interface TenderProofCandidate {
  candidate_id: string;
  title_observed: string | null;
  selection_label_observed?: string | null;
  detail_url_observed: string;
  external_id: string | null;
}

export interface TenderProofEvidence {
  evidence_id: string;
  artifact_id?: string | null;
  document_sha256?: string | null;
  page_number: number | null;
  snippet: string | null;
  json_path: string | null;
  method: string;
  method_version: string;
}

export interface TenderProofField {
  field_name: string;
  state: 'supported' | 'unknown' | 'failed' | 'conflict';
  value: unknown;
  evidence: TenderProofEvidence[];
  reason: string | null;
}

export interface TenderProofComparisonField {
  field_name: string;
  baseline_value: unknown;
  tenderproof_value: unknown;
  agreement: 'agree' | 'diverge' | 'no_evidence' | 'no_baseline';
  explanation: string;
  tenderproof_state?: TenderProofField['state'] | null;
}

export interface TenderProofSession {
  phase: 'discovery' | 'detail';
  session_id: string | null;
  replay_url: string | null;
  replay_status: TenderProofReplayStatus;
  replay_note: string | null;
  closed: boolean;
  closure_status?: 'confirmed' | 'requested' | 'unknown';
}

export interface TenderProofRun {
  coverage?: { scope?: string; complete?: boolean; parent_run_id?: string };
  run_id: string;
  source: string;
  mode: TenderProofMode;
  sample_note: string;
  execution_status: TenderProofExecutionStatus;
  validation_status: string;
  comparison_status: string;
  candidates: TenderProofCandidate[];
  selected_candidate_id: string | null;
  document: { doc_id: string; title: string; kind: string; reason_chosen: string } | null;
  artifact: { artifact_id: string; sha256: string; byte_len: number } | null;
  supplementary_documents?: { document: { title: string }; artifact: { artifact_id: string; sha256: string; byte_len: number } }[];
  document_selection?: { parent_run_id: string; case_id: string; reason: string; selected_at: string } | null;
  total_pages: number | null;
  processed_pages: number | null;
  truncated: boolean;
  page_errors: string[];
  fields: TenderProofField[];
  validation: { status: string; errors: string[]; warnings: string[] };
  comparison: {
    status: string;
    baseline_collected_at: string | null;
    baseline_origin: string;
    fields: TenderProofComparisonField[];
  };
  sessions: TenderProofSession[];
  diagnostics: string[];
  session_id: string | null;
  replay_url: string | null;
  replay_available: boolean;
  is_synthetic_sample: boolean;
  semantic_hash: string | null;
  error: string | null;
  document_review?: TenderProofDocumentReview;
}

export interface TenderProofDocumentReview {
  pending: boolean;
  reason?: string | null;
  documents: { title: string; url: string; kind?: string; change?: 'bytes_changed'; previous_sha256?: string; sha256?: string }[];
  detected_at?: number | null;
}

export async function getTenderProofDocumentReview(runId: string): Promise<TenderProofDocumentReview> {
  return (await apiClient.get(`/tenderproof/continuous/document-review/${encodeURIComponent(runId)}`)).data;
}

export type DocumentScope = { classification: 'research_scholarship'; reason: string; review_required: boolean;
  evidence: { document_sha256: string; page_number: number; snippet: string; extraction_method: string }[] };
export type DocumentEffectCase = {
  id: string;
  revision_hash: string;
  selected_document_sha256?: string;
  extraction_method_version?: string;
  draft?: (Partial<DocumentEffectDecision> & { sha256: string })[];
  draft_revision?: number;
  draft_saved_at?: number;
  ocr_regions?: OCRRegion[];
  documents: { document: { title: string; url: string; kind?: string }; artifact: { sha256: string; artifact_id: string }; pages: { page_number: number; text: string; extraction_method?: 'pdf_text' | 'ocr_tesseract'; extractor_version?: string | null; processing_job_id?: string | null }[]; ocr_review_required?: boolean; scope?: DocumentScope | null; fields?: TenderProofField[] }[];
};
export async function selectPreservedDocument(runId: string, review: DocumentEffectCase, artifactId: string, reason: string): Promise<TenderProofRun> {
  return (await apiClient.post(`/tenderproof/continuous/document-review/${encodeURIComponent(runId)}/cases/${review.id}/select-document`,
    { revision_hash: review.revision_hash, artifact_id: artifactId, reason }, { timeout: 400_000 })).data;
}
export type DocumentEffectDecision = { sha256: string; page: number; snippet: string; reason: string; effect: 'reflected_in_selected_document' | 'no_field_change'; region_id?: string | null };
export type RegistrationEffect = { kind: 'registration_reopening'; method_version: string; review_required: boolean;
  scope: { kind: 'function'; name: string; exclusive: boolean };
  act: { issuer: string; number: string; date: string }; original_act: { issuer: string; number: string; date: string };
  annulled_period: { start: string; end: string }; new_period: { start: string; end: string; end_time: string };
  evidence: { region_id: string; document_sha256: string; page_number: number; snippet: string; start: number; end: number }[] };
export type OCRVacancies = { method_version: string; review_required: boolean; total_vagas: number; total_pcd: number; notice: string;
  rows: { nome: string; cidade: string | null; jornada: string; vagas_imediatas: number; vagas_ampla_concorrencia: number;
    vagas_pcd: number | null; pending_fields: string[] }[] };
export type OCRRoleDetails = { method_version: string; review_required: boolean; nome: string; remuneracao: string; moeda: string; requisitos: string; jornada: string;
  association_status: 'matched' | 'missing_vacancy_row' | 'conflicting_vacancy_row' };
export type OCRRegion = { id: string; document_sha256: string; page_number: number; text: string; bounds: number[]; word_indices: number[]; boundary_words_excluded: number; method_version: string; review_required: boolean; preview_fields: TenderProofField[]; preview_effects?: RegistrationEffect[]; preview_effects_version?: string; preview_vacancies?: OCRVacancies | null; preview_role_details?: OCRRoleDetails | null };
export async function prepareOCRRegion(runId: string, review: DocumentEffectCase, artifactId: string, pageNumber: number, bounds: number[]): Promise<OCRRegion> {
  return (await apiClient.post(`/tenderproof/continuous/document-review/${encodeURIComponent(runId)}/cases/${review.id}/ocr-regions`,
    { revision_hash: review.revision_hash, artifact_id: artifactId, page_number: pageNumber, bounds })).data;
}
export type RegistrationTargetComparison = { status: string; message?: string; title?: string; concurso_id?: number;
  review_required: boolean; published: false;
  comparisons?: { status: string; message: string; cargo_name?: string;
    proposed_registration?: { start: string; end: string; end_time: string } }[] };
export async function compareRegistrationTargets(runId: string, review: DocumentEffectCase, regionId: string): Promise<RegistrationTargetComparison> {
  return (await apiClient.post(`/tenderproof/continuous/document-review/${encodeURIComponent(runId)}/cases/${review.id}/registration-targets`,
    { revision_hash: review.revision_hash, region_id: regionId })).data;
}
export async function prepareDocumentEffects(runId: string): Promise<DocumentEffectCase> {
  return (await apiClient.post(`/tenderproof/continuous/document-review/${encodeURIComponent(runId)}/prepare`, {}, { timeout: 400_000 })).data;
}
export async function currentDocumentEffects(runId: string): Promise<DocumentEffectCase | null> {
  return (await apiClient.get(`/tenderproof/continuous/document-review/${encodeURIComponent(runId)}/current`)).data;
}
export async function approveDocumentEffects(runId: string, review: DocumentEffectCase, decisions: DocumentEffectDecision[]) {
  return (await apiClient.post(`/tenderproof/continuous/document-review/${encodeURIComponent(runId)}/cases/${review.id}/approve`, { revision_hash: review.revision_hash, decisions })).data;
}

export async function saveDocumentEffectsDraft(runId: string, review: DocumentEffectCase, decisions: Partial<DocumentEffectDecision>[]): Promise<{ draft_revision: number; draft_saved_at: number }> {
  return (await apiClient.put(`/tenderproof/continuous/document-review/${encodeURIComponent(runId)}/cases/${review.id}/draft`,
    { revision_hash: review.revision_hash, draft_revision: review.draft_revision ?? 0, decisions })).data;
}

// Operações reais podem durar minutos (sessão remota); o timeout padrão de
// 10 s abortaria a interface enquanto o servidor continuaria o trabalho.
// Estas chamadas aguardam de forma visível (spinner) em vez de falhar cedo.
const LONG_TIMEOUT_MS = 400_000;

export const startTenderProofRun = async (mode: TenderProofMode, source = 'ibgp_open'): Promise<TenderProofRun> => {
  const { data } = await apiClient.post<TenderProofRun>(
    '/tenderproof/runs', { mode, source }, { timeout: LONG_TIMEOUT_MS },
  );
  return data;
};

export interface TenderProofProposal {
  kind?: 'field_amendment' | string;
  document_review?: TenderProofDocumentReview;
  document_access?: { mode: 'preserved_pdf'; official_page_url: string; artifact_download_path: string; artifact_id: string; sha256: string; requires_authentication: true } | null;
  id: string;
  action?: 'create' | 'update';
  creation_metadata?: { banca: string; link_edital: string } | null;
  concurso_id: number | null;
  run_id?: string | null;
  identity: { source_id?: number; external_id?: string | null; detail_url?: string | null; reason?: string | null; edital_numero?: string | null; concurso_id?: number | null };
  required_fields?: string[];
  blockers?: string[];
  approved_fields?: string[];
  approved_by?: number | null;
  approved_at?: string | null;
  applied_at?: string | null;
  rollback_version_id?: number | null;
  rollback_reason?: string | null;
  evidences?: Record<string, { value?: unknown; state?: string; reason?: string | null; document_sha256?: string | null; items?: (TenderProofEvidence & { source_url?: string })[] }>;
  proposal_hash: string;
  state: string;
  stale?: boolean;
  baseline?: { values: Record<string, unknown> };
  proposed?: Record<string, unknown>;
  eligible_fields?: string[];
  blocked_fields?: Record<string, string>;
  version_id?: number | null;
  base_document?: TenderProofDocumentReference | null;
  amendment_document?: TenderProofDocumentReference | null;
  changes?: Record<string, TenderProofAmendmentChange>;
  periods?: Record<string, unknown> | null;
  events?: unknown[];
  reason?: string | null;
  authorization?: Record<string, unknown> | null;
  result?: { diff?: Record<string, { old: unknown; new: unknown }>; notification_status?: string; after_revision?: unknown; state?: string; periods?: Record<string, unknown>; events?: unknown[] } | null;
}

export interface TenderProofDocumentReference {
  title?: string | null;
  url?: string | null;
  sha256?: string | null;
  kind?: string | null;
  [key: string]: unknown;
}

export interface TenderProofAmendmentChange {
  field_name?: string;
  previous?: unknown;
  new?: unknown;
  label?: string | null;
  reason?: string | null;
  provenance?: { sha256?: string | null; document_sha256?: string | null; page?: number | null; page_number?: number | null; snippet?: string | null; source_url?: string | null; [key: string]: unknown }[];
}

export async function createTenderProofProposal(run_id: string, concurso_id: number | null = null): Promise<TenderProofProposal> {
  return (await apiClient.post('/tenderproof/publications/proposals', { run_id, concurso_id })).data;
}

export async function getTenderProofProposal(id: string): Promise<TenderProofProposal> {
  return (await apiClient.get(`/tenderproof/publications/proposals/${encodeURIComponent(id)}`)).data;
}

export async function rollbackTenderProofProposal(id: string, reason: string): Promise<TenderProofProposal> {
  return (await apiClient.post(`/tenderproof/publications/proposals/${encodeURIComponent(id)}/rollback`, { reason })).data;
}

export interface ContinuousSource {
  source: string; enabled: boolean; mode: string; browser_hold: string | null;
  known_candidates: number; pending_reviews: number;
  cycles: { cycle_id: string; status: string; finished_at: number | null; reasons: string[] }[];
}
export interface ContinuousObservation {
  observation_id: string; source: string; mode: string; run_id: string; status: string; last_seen: number;
  summary: { title?: string; validation_status?: string; documents?: unknown[]; document_review?: TenderProofDocumentReview; [key: string]: unknown };
}
export interface ContinuousStatus {
  operationally_enabled: boolean; operator_authorized: boolean; sources: ContinuousSource[];
}
export interface ContinuousCatalogueSource {
  number: number; source: string; name: string; category: string; listing_urls: string[];
  adapter_registered: boolean; adapter_implemented: boolean; adapter: string | null; homologation: string; mock_available: boolean;
  implementation_state?: string; implementation_scope?: string | null;
}
export async function getTenderProofCatalogue(): Promise<ContinuousCatalogueSource[]> {
  return (await apiClient.get('/tenderproof/continuous/catalogue')).data;
}
export async function getTenderProofContinuousStatus(): Promise<ContinuousStatus> {
  return (await apiClient.get('/tenderproof/continuous/status')).data;
}
export async function getTenderProofObservations(offset = 0, source?: string): Promise<ContinuousObservation[]> {
  return (await apiClient.get('/tenderproof/continuous/observations', { params: { offset, limit: 20, ...(source ? { source } : {}) } })).data;
}

export async function actTenderProofProposal(proposal: TenderProofProposal, action: 'approve' | 'apply', fields: string[] = []): Promise<TenderProofProposal> {
  return (await apiClient.post(`/tenderproof/publications/proposals/${proposal.id}/${action}`,
    { proposal_hash: proposal.proposal_hash, ...(action === 'approve' ? { fields } : {}) })).data;
}

export const getTenderProofRun = async (runId: string): Promise<TenderProofRun> => {
  const { data } = await apiClient.get<TenderProofRun>(`/tenderproof/runs/${runId}`);
  return data;
};

export interface TenderProofRecollection {
  job_id: string; cycle_id: string; status: string; run_id: string | null; error: string | null;
}
export async function getTenderProofRecollection(runId: string): Promise<TenderProofRecollection | null> {
  return (await apiClient.get(`/tenderproof/continuous/runs/${runId}/recollection`)).data;
}
export async function requestTenderProofRecollection(runId: string): Promise<TenderProofRecollection> {
  return (await apiClient.post(`/tenderproof/continuous/runs/${runId}/recollection`, {})).data;
}

export const selectTenderProofCandidate = async (
  runId: string,
  candidateId: string,
  mode: TenderProofMode,
): Promise<TenderProofRun> => {
  const { data } = await apiClient.post<TenderProofRun>(
    `/tenderproof/runs/${runId}/select`,
    { candidate_id: candidateId, mode },
    { timeout: LONG_TIMEOUT_MS },
  );
  return data;
};

export const refreshTenderProofReplay = async (runId: string): Promise<TenderProofRun> => {
  const { data } = await apiClient.post<TenderProofRun>(
    `/tenderproof/runs/${runId}/replay/refresh`, {}, { timeout: 60_000 },
  );
  return data;
};

export const reconcileTenderProofSessions = async (runId: string): Promise<TenderProofRun> => {
  const { data } = await apiClient.post<TenderProofRun>(
    `/tenderproof/runs/${runId}/sessions/reconcile`, {}, { timeout: 60_000 },
  );
  return data;
};

export const fetchTenderProofPdfBytes = async (
  runId: string,
  artifactId: string,
): Promise<ArrayBuffer> => {
  const { data } = await apiClient.get<ArrayBuffer>(
    `/tenderproof/runs/${runId}/artifacts/${artifactId}`,
    { responseType: 'arraybuffer', timeout: 60_000 },
  );
  return data;
};
