import type { MappingProfile } from "../transfer/types"

export type ScalarValue = string | number | boolean | null

export type PageControl = {
  control_id: string
  tag: string
  type: string
  role: string
  name: string
  label: string
  label_text?: string
  group_text?: string
  placeholder: string
  required: boolean
  disabled: boolean
  current_value: ScalarValue
  checked: boolean | null
  options: Array<{ value: string; label: string }>
}

export type ExternalContextEnvelope = {
  task: "field_match"
  provider_id: string
  provider_name: string
  provider_origin: string
  provider_base_url: string
  provider_model: string
  controls: Array<{ control_id: string; label: string; label_text?: string; group_text?: string; type: string }>
  candidates: Array<{ information_path: string; label_text?: string; group_text?: string; value: ScalarValue }>
}

export type PersonalHomeData = {
  profiles: MappingProfile[]
}

export type PersonalAiSettingsView = {
  aiMode: "local_only" | "local_then_ask_external"
  selectedModelId?: string | null
  localModelEnabled: boolean
  localModelId: string | null
  localModelStatus: "not_ready" | "ready" | "loading" | "failed" | "unsupported_device"
  localModelDetail?: string
  localModels: Array<{
    id: string
    displayName: string
    modelArtifact: string
    runtimeAvailable: boolean
    experimental: boolean
    unavailableReason?: string
    status: "not_ready" | "ready" | "loading" | "failed" | "unsupported_device"
    detail?: string
    estimatedDownloadBytes: number
    estimatedPeakMemoryMb: number
  }>
  apiModelId?: string | null
  apiModels?: Array<{
    id: string
    displayName: string
    provider: "gemini" | "deepseek"
    origin: string
    model: string
    status: "ready" | "not_ready"
    detail?: string
    configured: boolean
    hasKey: boolean
    rememberKey: boolean
  }>
  provider: {
    id: string
    displayName: string
    baseUrl: string
    model: string
    rememberKey: boolean
    enabled: boolean
    hasKey: boolean
  } | null
  neverSendInformationPaths: string[]
}
