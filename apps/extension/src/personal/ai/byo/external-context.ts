import type { ExternalContextEnvelope, ScalarValue } from "../../../shared/types"
import { canonicalProviderBaseUrl, canonicalProviderOrigin } from "./secret-store"

const CANDIDATES_PER_CONTROL = 5

function lexicalScore(label: string, informationPath: string): number {
  const terms = (value: string) => new Set(
    value.normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [],
  )
  const left = terms(label)
  const right = terms(informationPath.replaceAll(".", " "))
  const intersection = [...left].filter((term) => right.has(term)).length
  return intersection / Math.max(1, new Set([...left, ...right]).size)
}

function relevantCandidates(
  controls: Array<{ label: string }>,
  candidates: Array<{ information_path: string; value: ScalarValue }>,
) {
  const selected = new Map<string, { information_path: string; value: ScalarValue }>()
  for (const control of controls) {
    candidates
      .map((candidate) => ({ candidate, score: lexicalScore(control.label, candidate.information_path) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, CANDIDATES_PER_CONTROL)
      .forEach(({ candidate }) => selected.set(candidate.information_path, candidate))
  }
  return [...selected.values()]
}

export function minimumFieldMatchContext(input: {
  providerId: string
  providerName: string
  providerBaseUrl: string
  providerModel: string
  controls: Array<{ control_id: string; label: string; type: string }>
  candidates: Array<{ information_path: string; value: ScalarValue }>
  neverSendInformationPaths: string[]
}): ExternalContextEnvelope {
  const blocked = new Set(input.neverSendInformationPaths)
  const controls = input.controls.map(({ control_id, label, type }) => ({
    control_id,
    label,
    type,
  }))
  const allowed = input.candidates.filter((item) => !blocked.has(item.information_path))
  const candidates = relevantCandidates(controls, allowed)
  return Object.freeze({
    task: "field_match",
    provider_id: input.providerId,
    provider_name: input.providerName,
    provider_origin: canonicalProviderOrigin(input.providerBaseUrl),
    provider_base_url: canonicalProviderBaseUrl(input.providerBaseUrl),
    provider_model: input.providerModel,
    controls: Object.freeze(controls.map((control) => Object.freeze(control))),
    candidates: Object.freeze(candidates.map((candidate) => Object.freeze(candidate))),
  }) as ExternalContextEnvelope
}

export function externalModelInput(envelope: ExternalContextEnvelope) {
  return envelope
}
