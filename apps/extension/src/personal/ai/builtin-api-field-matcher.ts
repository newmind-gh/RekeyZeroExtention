import type { PageControl } from "../../shared/types"
import { putStored } from "../storage/indexed-db"
import type { PersonalLlmLog, PersonalLlmLogMatch } from "../storage/schema"
import { LOCAL_FIELD_MATCH_PROMPT, localFieldMatchInput } from "./field-match-prompt"
import type { LocalFieldMatchOutput } from "./field-match-prompt"
import { DirectApiProvider, builtinApiModel, builtinApiModelConfig } from "./direct-api-provider"
import { exactFieldMatches, validateFieldMatches } from "./semantic-matcher"
import type { SourceFieldCandidate, StableFieldMatch } from "./semantic-matcher"

function fieldIdentity(label: string, section: string): string {
  return section ? `${label} | section: ${section}` : label
}

export async function matchFieldsWithBuiltinApi(input: {
  modelId: string
  target?: string
  controls: PageControl[]
  allTargetControls?: PageControl[]
  candidates: SourceFieldCandidate[]
}): Promise<StableFieldMatch[]> {
  const exactMatches = exactFieldMatches(
    input.controls,
    input.candidates,
    input.allTargetControls ?? input.controls,
  )
  const exactTargets = new Set(exactMatches.map((match) => match.control_id))
  const exactSources = new Set(exactMatches.map((match) => match.information_path))
  const unresolvedControls = input.controls.filter((control) => !exactTargets.has(control.control_id))
  const remainingCandidates = input.candidates.filter((candidate) => !exactSources.has(candidate.information_path))

  let result: Awaited<ReturnType<DirectApiProvider["completeJson"]>> | null = null
  let acceptedAiMatches: StableFieldMatch[] = []
  const rejectedMappings: unknown[] = []

  if (unresolvedControls.length && remainingCandidates.length) {
    const model = builtinApiModel(input.modelId)
    const config = await builtinApiModelConfig(input.modelId)
    const provider = new DirectApiProvider(model, config.model)
    const health = await provider.health()
    if (health.status !== "ready") throw new Error(health.detail || "Enter the API key in the extension UI")

    const localInput = localFieldMatchInput(unresolvedControls, remainingCandidates)
    const schema = {
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
              source: {
                type: ["string", "null"],
                enum: [...localInput.sourceFields.map((field) => field.identity), null],
              },
              target: { type: "string", enum: localInput.targetFields.map((field) => field.identity) },
            },
          },
        },
      },
    }
    const request = {
      task: "field_match" as const,
      system: LOCAL_FIELD_MATCH_PROMPT,
      input: localInput.text,
      schema,
      maxTokens: Math.min(1_024, 128 + unresolvedControls.length * 64),
    }
    result = await provider.completeJson<LocalFieldMatchOutput>(request)
    const output = result.output as LocalFieldMatchOutput
    if (!output || !Array.isArray(output.decisions)) throw new Error("AI returned an invalid match result")

    const targetDecisionCounts = new Map<string, number>()
    output.decisions.forEach((decision) => {
      if (typeof decision?.target !== "string") return
      targetDecisionCounts.set(decision.target, (targetDecisionCounts.get(decision.target) ?? 0) + 1)
    })

    const proposals = output.decisions.flatMap((decision) => {
      const targets = typeof decision?.target === "string"
        ? unresolvedControls.filter((control) =>
            fieldIdentity(control.label_text ?? control.label, control.group_text ?? "") === decision.target
          )
        : []
      if (targets.length !== 1) {
        rejectedMappings.push({ ...decision, reason: targets.length > 1 ? "ambiguous_identity" : "invalid_identity" })
        return []
      }
      if ((targetDecisionCounts.get(decision.target) ?? 0) > 1) {
        rejectedMappings.push({ ...decision, reason: "duplicate_target" })
        return []
      }
      if (decision.source === null) return []
      const sources = typeof decision.source === "string"
        ? remainingCandidates.filter((candidate) =>
            fieldIdentity(candidate.label_text ?? candidate.information_path, candidate.group_text ?? "") === decision.source
          )
        : []
      if (sources.length !== 1) {
        rejectedMappings.push({ ...decision, reason: sources.length > 1 ? "ambiguous_identity" : "invalid_identity" })
        return []
      }
      return [{ control_id: targets[0].control_id, information_path: sources[0].information_path }]
    })

    const validation = validateFieldMatches(proposals, unresolvedControls, remainingCandidates)
    acceptedAiMatches = validation.accepted
    rejectedMappings.push(...validation.rejected)
  }

  const matches = [...exactMatches, ...acceptedAiMatches]
  const describeMatch = (match: StableFieldMatch): PersonalLlmLogMatch => ({
    ...match,
    target_label: input.controls.find((control) => control.control_id === match.control_id)?.label_text
      ?? input.controls.find((control) => control.control_id === match.control_id)?.label
      ?? "Unknown target field",
    source_label: input.candidates.find((candidate) => candidate.information_path === match.information_path)?.label_text
      ?? match.information_path,
  })

  await putStored<PersonalLlmLog>("llm_logs", {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    task: "field_match",
    target: input.target ?? "Unknown target page",
    providerId: result?.providerId ?? "deterministic",
    modelId: result?.modelId ?? "none",
    exact_matches: exactMatches.map(describeMatch),
    ai_request: result ? { provider: input.modelId, task: "field_match" } : null,
    raw_response: result?.rawResponses.join("\n") ?? "",
    parsed_mappings: result ? (result.output as LocalFieldMatchOutput).decisions : [],
    rejected_mappings: rejectedMappings,
    final_mappings: matches.map(describeMatch),
  })

  return matches
}
