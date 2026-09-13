export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000"

export type ConfigItem = Record<string, unknown> & { id: string; name?: string; type?: string }
export type ConfigSnapshot = { sources: ConfigItem[]; schemas: ConfigItem[]; models: ConfigItem[]; model_policies: ConfigItem[]; targets: ConfigItem[]; flows: ConfigItem[] }
export type DbosWorkflowStage = { name: string; kind: "automated" | "model" | "human_action" | "human_review" | "output" }
export type DbosWorkflow = { id: string; name: string; function_name: string; description: string; inputs: string[]; engine: string; stages: DbosWorkflowStage[] }
export type AssetRecord = { id: string; intake_id: string; name: string; media_type: string; content_text?: string | null; content_base64?: string | null; preview_text?: string | null; preview_mode?: string; preview_metadata?: Record<string, unknown>; metadata: Record<string, unknown> }
export type EvidenceRecord = { id: string; asset_id: string; field_path: string; value: unknown; confidence: number; locator: Record<string, unknown>; method?: string; model_id: string | null }
export type ExecutionRecord = { id: string; status: string; tool: string; request_data: Record<string, unknown>; result_data: Record<string, unknown>; external_ref: string | null }
export type InformationConflict = { field_path: string; previous: unknown; received: unknown }
export type InformationRevision = { id: string; record_id: string; version: number; information: Record<string, unknown>; schema_snapshot?: Record<string, unknown> | null; created_from?: { conflicts?: InformationConflict[]; [key: string]: unknown }; status: string; validated_at?: string | null; validated_by?: string | null }
export type InformationSource = { id: string; name: string; type: string; initiating?: boolean }
export type ActionRecord = { id: string; record_revision_id?: string | null; target_id: string; target_name: string; target_type: string; action_type: string; tool: string; status: string; payload: Record<string, unknown>; prepared_payload?: Record<string, unknown>; confirmed_payload?: Record<string, unknown> | null; execution: ExecutionRecord | null }
export type CaseResponseContent = { subject: string; message: string; document_type: "none" | "pdf" | "docx"; document_filename: string; document_template: string }
export type CaseResponseRecord = { id: string; record_id: string; source_id: string; media_type: string; status: string; prepared_content: Partial<CaseResponseContent>; confirmed_content?: Partial<CaseResponseContent> | null; model_id?: string | null; confirmed_at?: string | null; confirmed_by?: string | null; sent_at?: string | null; delivery_result: Record<string, unknown> }
export type RecordMetrics = { facts_captured: number; downstream_actions: number; downstream_fields_reused: number; manual_rekeys: number; completed_executions: number }
export type RecordProcess = { workflow_id: string; name: string; status: string; created_at?: number | null }
export type RecordProcesses = { record_id: string; active: RecordProcess[]; active_count: number }
export type InformationRecord = { id: string; case_id: string; schema_id: string; schema_name: string; information_structure_name?: string; schema_version: string; status: string; data: Record<string, unknown>; active_revision?: InformationRevision | null; current_validated_revision?: InformationRevision | null; pending_review_revision?: InformationRevision | null; initiating_source_id?: string | null; initiating_intake_id?: string | null; created_at: string; updated_at: string; sources: InformationSource[]; source_files: string[]; assets: AssetRecord[]; evidence: EvidenceRecord[]; actions: ActionRecord[]; case_responses: CaseResponseRecord[]; metrics: RecordMetrics }
export type InformationRecordDetail = InformationRecord & { revisions: InformationRevision[]; intakes: ConfigItem[]; artifacts: ConfigItem[]; events: ConfigItem[] }
export type IntakeCreated = { intake_id: string; record_id: string; record_status: string }
export type UploadAsset = { name: string; media_type: string; content_base64: string }
export type UseCaseMode = "shadow" | "assisted" | "exception"
export type FieldHealth = { field: string; total: number; comparable: number; matches: number; corrections: number; disagreements: number; match_rate: number | null }
export type Performance = { completed_runs: number; field_comparisons: number; match_rate: number | null; shadow_match_rate: number | null; shadow_disagreement_rate: number | null; prediction_coverage: number | null; material_disagreement_rate: number | null; missing_information_rate: number | null; exception_rate: number | null; unsupported_control_rate: number | null; correction_rate: number | null; assisted_correction_rate: number | null; exception_correction_rate: number | null; fields_reused: number; baseline_manual_seconds_per_field: number | null; estimated_minutes_saved: number; response_capture_rate: number | null; writeback_success_rate: number | null; field_health: FieldHealth[] }
export type UseCaseRun = { id: string; use_case_id: string; record_id: string; revision_id: string; mode: UseCaseMode; status: string; summary: Record<string, unknown>; started_at: string; completed_at?: string | null; field_outcomes: Array<{ id: string; destination_field: string; information_path: string; predicted_value: unknown; observed_value: unknown; outcome: string; material: boolean; was_exception: boolean; was_filled_by_rekeyzero: boolean; was_corrected_by_user: boolean; missing_prediction: boolean; unsupported: boolean; not_comparable: boolean }> }
export type UseCase = { id: string; name: string; description: string; source_ids: string[]; destination_target_id: string; system_of_record_target_id?: string | null; mode: UseCaseMode; critical_fields: string[]; promotion_policy: Record<string, unknown>; writeback_mapping: Record<string, string>; enabled: boolean; version: number; created_at: string; updated_at: string; performance?: Performance; promotion_review?: { eligible: boolean; next_mode: UseCaseMode | null; checks: Record<string, boolean>; critical_error_rate: number; observation_days: number }; runs?: UseCaseRun[] }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  if (!response.ok) {
    const responseText = await response.text()
    let detail = responseText
    try {
      const payload = JSON.parse(responseText) as { detail?: unknown }
      if (typeof payload.detail === "string") detail = payload.detail
    } catch {
      // Keep non-JSON error responses as plain text.
    }
    throw new Error(detail || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  config: () => request<ConfigSnapshot>("/api/config"),
  dbosWorkflows: () => request<DbosWorkflow[]>("/api/config/dbos-workflows"),
  records: () => request<InformationRecord[]>("/api/records"),
  record: (recordId: string) => request<InformationRecordDetail>(`/api/records/${recordId}`),
  deleteRecord: (recordId: string) => request<{ record_id: string; stopped: Record<string, unknown>; deleted: Record<string, number> }>(`/api/records/${recordId}`, { method: "DELETE" }),
  recordProcesses: (recordId: string) => request<RecordProcesses>(`/api/records/${recordId}/processes`),
  stopRecordProcesses: (recordId: string) => request<Record<string, unknown>>(`/api/records/${recordId}/stop`, { method: "POST" }),
  uploadFiles: (assets: UploadAsset[], sourceId = "source_upload") => request<IntakeCreated>("/api/intakes", { method: "POST", body: JSON.stringify({ source_id: sourceId, assets }) }),
  setDefaultInformationStructure: (settings: { mode: "non_predefined" | "predefined"; planner_field_limit: number }) => request<ConfigItem>("/api/config/default-information-structure", { method: "PUT", body: JSON.stringify(settings) }),
  addSource: (source: Record<string, unknown>) => request<ConfigItem>("/api/config/sources", { method: "POST", body: JSON.stringify(source) }),
  updateSource: (sourceId: string, source: Record<string, unknown>) => request<ConfigItem>(`/api/config/sources/${sourceId}`, { method: "PUT", body: JSON.stringify(source) }),
  addTarget: (target: Record<string, unknown>) => request<ConfigItem>("/api/config/targets", { method: "POST", body: JSON.stringify(target) }),
  updateTarget: (targetId: string, target: Record<string, unknown>) => request<ConfigItem>(`/api/config/targets/${targetId}`, { method: "PUT", body: JSON.stringify(target) }),
  ingestRecord: (recordId: string) => request<Record<string, unknown>>(`/api/records/${recordId}/ingest`, { method: "POST" }),
  validateRevision: (recordId: string, revisionId: string, information?: Record<string, unknown>) => request<InformationRevision>(`/api/records/${recordId}/revisions/${revisionId}/validate`, { method: "POST", body: JSON.stringify({ information }) }),
  prepareDestination: (recordRevisionId: string, targetId: string) => request<ActionRecord>("/api/destinations/prepare", { method: "POST", body: JSON.stringify({ record_revision_id: recordRevisionId, target_id: targetId }) }),
  prepareCaseResponse: (recordId: string) => request<CaseResponseRecord>(`/api/records/${recordId}/case-response/prepare`, { method: "POST" }),
  confirmAndSendCaseResponse: (responseId: string, content: CaseResponseContent) => request<CaseResponseRecord>(`/api/case-responses/${responseId}/confirm-and-send`, { method: "POST", body: JSON.stringify({ content }) }),
  confirmAction: (actionId: string, confirmedPayload?: Record<string, unknown>) => request<ActionRecord>(`/api/actions/${actionId}/confirm`, { method: "POST", body: JSON.stringify({ confirmed_payload: confirmedPayload }) }),
  executeAction: (actionId: string) => request<{ workflow_id: string; status: string }>(`/api/actions/${actionId}/execute`, { method: "POST" }),
  executeActions: (actionIds: string[], executionMode: "parallel" | "sequential") => request<{ workflow_id: string; status: string; action_ids: string[]; execution_mode: string }>("/api/actions/execute", { method: "POST", body: JSON.stringify({ action_ids: actionIds, execution_mode: executionMode }) }),
  modelHealth: (modelId: string) => request<{ ready: boolean; provider: string; model: string; base_url?: string; error?: string; installed_models?: string[] }>(`/api/models/${modelId}/health`),
  useCases: () => request<UseCase[]>("/api/use-cases"),
  useCase: (useCaseId: string) => request<UseCase>(`/api/use-cases/${useCaseId}`),
  addUseCase: (payload: Record<string, unknown>) => request<UseCase>("/api/use-cases", { method: "POST", body: JSON.stringify(payload) }),
  updateUseCase: (useCaseId: string, payload: Record<string, unknown>) => request<UseCase>(`/api/use-cases/${useCaseId}`, { method: "PUT", body: JSON.stringify(payload) }),
  setUseCaseMode: (useCaseId: string, mode: UseCaseMode, reason: string, overrideQualification = false) => request<UseCase>(`/api/use-cases/${useCaseId}/mode`, { method: "POST", body: JSON.stringify({ mode, reason, override_qualification: overrideQualification }) }),
  performance: () => request<Performance>("/api/performance"),
}
