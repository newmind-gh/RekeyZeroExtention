export type RevisionStatus = "draft" | "pending_review" | "validated"
export type RevisionSource = "human" | "import"

export type PersonalInformationRecord = {
  id: string
  name: string
  current_validated_revision_id: string | null
  created_at: string
  updated_at: string
}

export type PersonalInformationRevision = {
  id: string
  record_id: string
  version: number
  status: RevisionStatus
  information: Record<string, unknown>
  created_from: RevisionSource
  created_at: string
  validated_at?: string
}

export type PersonalEvidence = {
  id: string
  revision_id: string
  information_path: string
  method: "human" | "import" | "local_model" | "external_model"
  excerpt: string
  provider_id?: string
  model_id?: string
  created_at: string
}

export type PersonalProviderConfig = {
  id: string
  providerType: "openai_compatible"
  displayName: string
  baseUrl: string
  model: string
  rememberKey: boolean
  enabled: boolean
}

export type PersonalAiMode = "local_only" | "local_then_ask_external"

export type PersonalSettings = {
  id: "personal"
  aiMode: PersonalAiMode
  localModelId: string | null
  localModelEnabled: boolean
  apiModelId?: string | null
  externalProviderId: string | null
  externalDataPolicy: {
    default: "ask"
    neverSendInformationPaths: string[]
  }
}

export type PersonalLlmLogMatch = {
  control_id: string
  target_label: string
  information_path: string
  source_label: string
}

export type PersonalLlmLog = {
  id: string
  createdAt: string
  task: "field_match" | "runtime_error"
  target: string
  providerId: string
  modelId: string
  status?: "success" | "error"
  request_type?: string
  error?: {
    message: string
    stack?: string
  }
  exact_matches: PersonalLlmLogMatch[]
  raw_request?: unknown | null
  ai_request?: unknown | null
  raw_response: string
  parsed_mappings: unknown[]
  rejected_mappings: unknown[]
  final_mappings: PersonalLlmLogMatch[]
}

export const PERSONAL_STORES = [
  "records",
  "revisions",
  "evidence",
  "provider_configs",
  "settings",
  "transfer_mapping_profiles",
  "llm_logs",
] as const

export type PersonalStoreName = (typeof PERSONAL_STORES)[number]
