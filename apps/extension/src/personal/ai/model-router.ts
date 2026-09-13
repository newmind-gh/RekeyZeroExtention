import type { ExternalContextEnvelope, PageControl, ScalarValue } from "../../shared/types"
import { getStored } from "../storage/indexed-db"
import type { PersonalProviderConfig, PersonalSettings } from "../storage/schema"
import { assertRequestedRoute, routeTask } from "../core/capability-gate"
import type { CapabilityDecision } from "../core/capability-gate"
import { OpenAiCompatibleProvider } from "./byo/openai-compatible"
import { externalModelInput, minimumFieldMatchContext } from "./byo/external-context"
import { canonicalProviderBaseUrl, canonicalProviderOrigin } from "./byo/secret-store"
import { fieldIdentity, LOCAL_FIELD_MATCH_PROMPT, localFieldMatchInput } from "./field-match-prompt"
import type { LocalFieldMatchOutput } from "./field-match-prompt"
import { LocalModelProvider } from "./local-model-provider"
import type { PersonalModelProvider } from "./model-provider"
import type { ModelRequest } from "./model-provider"
import type { SourceFieldCandidate } from "./semantic-matcher"

export type FieldMatch = {
  control_id: string
  information_path: string
  confidence: "high" | "medium" | "low"
}

type FieldMatchOutput = { matches: FieldMatch[] }

type RejectedLocalMapping = LocalFieldMatchOutput["decisions"][number] & {
  reason: "invalid_identity" | "ambiguous_identity" | "duplicate_target"
}

type TimedModelRequest = ModelRequest & {
  timing: {
    request_started_at: string
    response_received_at: string
    elapsed_ms: number
  }
}

function validateMatches(
  output: FieldMatchOutput,
  controls: Array<{ control_id: string }>,
  candidates: Array<{ information_path: string; value: unknown }>,
): FieldMatch[] {
  const controlIds = new Set(controls.map((control) => control.control_id))
  const paths = new Set(candidates.map((candidate) => candidate.information_path))
  if (!output || !Array.isArray(output.matches)) throw new Error("AI returned an invalid match result")
  return output.matches.filter((match) =>
    controlIds.has(match.control_id)
    && paths.has(match.information_path)
    && match.confidence === "high",
  )
}

export function assertExternalProviderContext(
  envelope: ExternalContextEnvelope,
  config: PersonalProviderConfig,
): void {
  if (
    envelope.provider_id !== config.id
    || envelope.provider_origin !== canonicalProviderOrigin(config.baseUrl)
    || envelope.provider_base_url !== canonicalProviderBaseUrl(config.baseUrl)
    || envelope.provider_model !== config.model
    || envelope.provider_name !== config.displayName
  ) throw new Error("The AI provider configuration changed; review the external data again")
}

export class PersonalModelRouter {
  constructor(
    private readonly localProvider: (modelId: string) => PersonalModelProvider =
      (modelId) => new LocalModelProvider(modelId),
  ) {}

  async externalContext(input: {
    controls: PageControl[]
    candidates: Array<{ information_path: string; value: ScalarValue }>
  }): Promise<ExternalContextEnvelope | null> {
    const settings = await getStored<PersonalSettings>("settings", "personal")
    if (!settings?.externalProviderId) return null
    const provider = await getStored<PersonalProviderConfig>("provider_configs", settings.externalProviderId)
    if (!provider?.enabled) return null
    return minimumFieldMatchContext({
      providerId: settings.externalProviderId,
      providerName: provider.displayName,
      providerBaseUrl: provider.baseUrl,
      providerModel: provider.model,
      controls: input.controls,
      candidates: input.candidates,
      neverSendInformationPaths: settings.externalDataPolicy.neverSendInformationPaths,
    })
  }

  externalDisclosure(envelope: ExternalContextEnvelope) {
    return {
      provider_id: envelope.provider_id,
      provider_name: envelope.provider_name,
      destination_fields: envelope.controls.length,
      candidate_facts: envelope.candidates.length,
      total_chars: JSON.stringify(envelope).length,
      data: structuredClone(envelope),
    }
  }

  async decision(input: {
    destinationFieldCount: number
    unresolvedFieldCount: number
    contextChars: number
  }): Promise<CapabilityDecision> {
    const settings = await getStored<PersonalSettings>("settings", "personal")
    const localProvider = settings?.localModelEnabled && settings.localModelId
      ? this.localProvider(settings.localModelId)
      : null
    const provider = settings?.externalProviderId
      ? await getStored<PersonalProviderConfig>("provider_configs", settings.externalProviderId)
      : null
    const health = localProvider ? await localProvider.health() : null
    return routeTask({
      task: "field_match",
      destinationFieldCount: input.destinationFieldCount,
      unresolvedFieldCount: input.unresolvedFieldCount,
      contextChars: input.contextChars,
      sourceItemCount: 1,
      attachmentCount: 0,
      attachmentTypes: [],
      requiresVision: false,
      requiresLongContext: false,
      webgpuAvailable: typeof navigator !== "undefined" && "gpu" in navigator,
      localModelReady: health?.status === "ready",
      externalProviderEnabled: Boolean(provider?.enabled && settings?.aiMode === "local_then_ask_external"),
    })
  }

  async matchFields(input: {
    route: "local_lite" | "external_api"
    controls: PageControl[]
    candidates: SourceFieldCandidate[]
    decision: CapabilityDecision
    externalContext?: ExternalContextEnvelope
  }): Promise<{ matches: FieldMatch[]; invalidMappings: RejectedLocalMapping[]; providerId: string; modelId: string; request: TimedModelRequest; response: FieldMatchOutput | LocalFieldMatchOutput; rawResponses: string[] }> {
    const settings = await getStored<PersonalSettings>("settings", "personal")
    assertRequestedRoute(input.decision, input.route)
    const localInput = localFieldMatchInput(input.controls, input.candidates)
    const externalControls = input.externalContext?.controls
    const externalCandidates = input.externalContext?.candidates
    if (input.route === "external_api" && (!externalControls || !externalCandidates)) throw new Error("The reviewed external AI context is unavailable")
    if (!input.candidates.length) throw new Error("No approved candidate facts are available for AI")

    let provider: PersonalModelProvider
    if (input.route === "local_lite") {
      if (!settings?.localModelEnabled || !settings.localModelId) throw new Error("Local AI is not enabled")
      const localProvider = this.localProvider(settings.localModelId)
      if ((await localProvider.health()).status !== "ready") throw new Error("Local AI is not ready")
      provider = localProvider
    } else {
      if (!settings?.externalProviderId) throw new Error("An external provider is not configured")
      if (input.externalContext?.provider_id !== settings.externalProviderId) {
        throw new Error("The AI provider changed; review the external data again")
      }
      if (input.externalContext.candidates.some((candidate) =>
        settings.externalDataPolicy.neverSendInformationPaths.includes(candidate.information_path)
      )) throw new Error("The external data policy changed; review the external data again")
      const config = await getStored<PersonalProviderConfig>("provider_configs", settings.externalProviderId)
      if (!config?.enabled) throw new Error("The external provider is disabled")
      assertExternalProviderContext(input.externalContext, config)
      provider = new OpenAiCompatibleProvider(config)
    }

    const localSchema = {
      type: "object",
      additionalProperties: false,
      required: ["decisions"],
      properties: {
        decisions: {
          type: "array",
          minItems: localInput.targetFields.length,
          maxItems: localInput.targetFields.length,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["source", "target"],
            properties: {
              source: { enum: [...localInput.sourceFields.map((field) => field.identity), null] },
              target: { type: "string", enum: localInput.targetFields.map((field) => field.identity) },
            },
          },
        },
      },
    }
    const externalSchema = {
      type: "object",
      additionalProperties: false,
      required: ["matches"],
      properties: {
        matches: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["control_id", "information_path", "confidence"],
            properties: {
              control_id: { type: "string" },
              information_path: { type: "string" },
              confidence: { enum: ["high", "medium", "low"] },
            },
          },
        },
      },
    }
    const request: ModelRequest = input.route === "local_lite" ? {
      task: "field_match",
      system: LOCAL_FIELD_MATCH_PROMPT,
      input: localInput.text,
      schema: localSchema,
      maxTokens: Math.min(1_024, 128 + input.controls.length * 64),
    } : {
      task: "field_match",
      system: "Match destination controls only to supplied candidate facts. Compare label_text and group_text as the primary semantic evidence, using type and value only for compatibility. Return compact JSON only. Never invent controls, paths, values, selectors, URLs, or browser actions. Use high confidence only for clear semantic equivalence.",
      input: externalModelInput(input.externalContext as ExternalContextEnvelope),
      schema: externalSchema,
      maxTokens: Math.min(1_024, 192 + input.controls.length * 112),
    }

    const requestStartedAt = new Date()
    const startedMs = performance.now()
    const result = await provider.completeJson<FieldMatchOutput | LocalFieldMatchOutput>(request)
    const responseReceivedAt = new Date()
    const timedRequest: TimedModelRequest = {
      ...request,
      timing: {
        request_started_at: requestStartedAt.toISOString(),
        response_received_at: responseReceivedAt.toISOString(),
        elapsed_ms: Math.round((performance.now() - startedMs) * 100) / 100,
      },
    }

    let responseMatches: FieldMatch[]
    const invalidMappings: RejectedLocalMapping[] = []
    if (input.route === "local_lite") {
      const output = result.output as LocalFieldMatchOutput
      if (!output || !Array.isArray(output.decisions)) throw new Error("AI returned an invalid match result")
      const targetDecisionCounts = new Map<string, number>()
      output.decisions.forEach((decision) => {
        if (typeof decision?.target !== "string") return
        targetDecisionCounts.set(decision.target, (targetDecisionCounts.get(decision.target) ?? 0) + 1)
      })
      responseMatches = output.decisions.flatMap((decision) => {
        const targets = typeof decision?.target === "string"
          ? input.controls.filter((control) =>
              fieldIdentity(control.label_text ?? control.label, control.group_text ?? "") === decision.target
            )
          : []
        if (targets.length !== 1) {
          const reason = targets.length > 1 ? "ambiguous_identity" as const : "invalid_identity" as const
          invalidMappings.push({ ...decision, reason })
          return []
        }
        if ((targetDecisionCounts.get(decision.target) ?? 0) > 1) {
          invalidMappings.push({ ...decision, reason: "duplicate_target" })
          return []
        }
        if (decision.source === null) return []
        const sources = typeof decision.source === "string"
          ? input.candidates.filter((candidate) =>
              fieldIdentity(candidate.label_text ?? candidate.information_path, candidate.group_text ?? "") === decision.source
            )
          : []
        if (sources.length !== 1) {
          const reason = sources.length > 1 ? "ambiguous_identity" as const : "invalid_identity" as const
          invalidMappings.push({ ...decision, reason })
          return []
        }
        return [{
          control_id: targets[0].control_id,
          information_path: sources[0].information_path,
          confidence: "high" as const,
        }]
      })
    } else {
      responseMatches = validateMatches(result.output as FieldMatchOutput, externalControls!, externalCandidates!)
    }
    return {
      matches: responseMatches.filter((match) => match.confidence === "high"),
      invalidMappings,
      providerId: result.providerId,
      modelId: result.modelId,
      request: timedRequest,
      response: result.output,
      rawResponses: result.rawResponses,
    }
  }
}
