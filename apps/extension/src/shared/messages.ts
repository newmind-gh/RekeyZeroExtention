import type { PersonalAiSettingsView } from "./types"
import type { Command, MappingProfile } from "../transfer/types"

export type WorkerRequest =
  | { type: "PERSONAL_GET_HOME" }
  | { type: "PERSONAL_SAVE_PROFILE"; profile: MappingProfile }
  | { type: "PERSONAL_DELETE_PROFILE"; profileId: string }
  | { type: "PERSONAL_SAVE_INFORMATION"; information: Record<string, unknown> }
  | {
      type: "PERSONAL_VALIDATE_PENDING"
      revisionId: string
      information?: Record<string, unknown>
    }
  | { type: "PERSONAL_DELETE_FACT"; path: string }
  | { type: "PERSONAL_DELETE_REVISION"; revisionId: string }
  | { type: "PERSONAL_IMPORT_INFORMATION"; fileName: string; content: string }
  | { type: "PERSONAL_CLEAR_ALL" }
  | { type: "PERSONAL_EXPORT" }
  | { type: "PERSONAL_EXPORT_RECOVERY" }
  | { type: "PERSONAL_EXPORT_DIAGNOSTICS" }
  | { type: "PERSONAL_GET_AI_SETTINGS" }
  | { type: "PERSONAL_GET_LLM_LOGS" }
  | { type: "PERSONAL_SET_LOCAL_AI_ENABLED"; enabled: boolean; modelId: string }
  | {
      type: "PERSONAL_CONFIGURE_API_MODEL"
      modelId: string
      model: string
      rememberKey: boolean
      apiKey?: string
    }
  | { type: "PERSONAL_REMOVE_API_MODEL"; modelId: string }
  | { type: "PERSONAL_AI_MATCH_TRANSFER" }
  | {
      type: "PERSONAL_SAVE_AI_SETTINGS"
      settings: {
        aiMode: PersonalAiSettingsView["aiMode"]
        localModelEnabled: boolean
        provider?: {
          displayName: string
          baseUrl: string
          model: string
          rememberKey: boolean
          apiKey?: string
        }
        neverSendInformationPaths: string[]
      }
    }
  | { type: "PERSONAL_LOAD_LOCAL_MODEL" }
  | { type: "PERSONAL_DELETE_LOCAL_MODEL" }
  | { type: "PERSONAL_TEST_PROVIDER" }
  | { type: "PERSONAL_REMOVE_PROVIDER" }
  | { type: "TRANSFER"; command: Command }
  | { type: "TRANSFER_TAB_READY"; tabId: number }
  | { type: "TRANSFER_INVALIDATE_TAB"; tabId: number }

export type WorkerResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type ContentRequest = { type: "PING" }

export type ContentResponse = { ok: true } | { ok: false; error: string }
