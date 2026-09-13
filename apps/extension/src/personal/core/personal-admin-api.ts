import type { PageControl, PersonalAiSettingsView, PersonalHomeData } from "../../shared/types"
import type { SourceFieldCandidate } from "../ai/semantic-matcher"
import type { PersonalLlmLog, PersonalSettings } from "../storage/schema"
import type { MappingProfile } from "../../transfer/types"

export interface PersonalAdminApi {
  home(): Promise<PersonalHomeData>
  saveProfile(profile: MappingProfile): Promise<PersonalHomeData>
  deleteProfile(profileId: string): Promise<PersonalHomeData>
  saveInformation(information: Record<string, unknown>): Promise<PersonalHomeData>
  validatePending(
    revisionId: string,
    information?: Record<string, unknown>,
  ): Promise<PersonalHomeData>
  deleteFact(path: string): Promise<PersonalHomeData>
  deleteRevision(revisionId: string): Promise<PersonalHomeData>
  importInformation(fileName: string, content: string): Promise<PersonalHomeData>
  clearAll(): Promise<void>
  exportData(): Promise<string>
  exportRecoveryData(): Promise<string>
  exportDiagnostics(): Promise<string>
  aiSettings(): Promise<PersonalAiSettingsView>
  llmLogs(): Promise<PersonalLlmLog[]>
  setLocalAiEnabled(enabled: boolean, modelId: string): Promise<PersonalAiSettingsView>
  matchLocalFields(input: {
    target?: string
    controls: PageControl[]
    allTargetControls?: PageControl[]
    candidates: SourceFieldCandidate[]
  }): Promise<Array<{ control_id: string; information_path: string }>>
  configureAi(input: {
    aiMode: PersonalSettings["aiMode"]
    localModelEnabled: boolean
    provider?: {
      displayName: string
      baseUrl: string
      model: string
      rememberKey: boolean
      apiKey?: string
    }
    neverSendInformationPaths: string[]
  }): Promise<PersonalAiSettingsView>
  loadLocalModel(): Promise<PersonalAiSettingsView>
  deleteLocalModel(): Promise<PersonalAiSettingsView>
  testProvider(): Promise<void>
  removeProvider(): Promise<PersonalAiSettingsView>
}
