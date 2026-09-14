import type { PageControl } from "../../shared/types"
import type { SourceFieldCandidate } from "./semantic-matcher"

export type LocalFieldMatchOutput = {
  decisions: Array<{
    source: string | null
    target: string
  }>
}

type LocalFieldIdentity = {
  identity: string
  label: string
  section: string
  type: string
  acceptedOptions?: Array<{ value: string; label: string }>
}

export const LOCAL_FIELD_MATCH_PROMPT = [
  "Match fields between two forms used for the same business task.",
  "The user message lists the source fields still available as candidates and the target fields still needing a match.",
  "For each target field, choose zero or one source field that represents the same business information, even when the wording is different.",
  "A match means the source and target represent the same data item. Do not match fields merely because they are related.",
  "Broader, narrower, descriptive, derived, or inferable information is not the same data item.",
  "Source fields are candidates only. Many source fields may remain unused. It is normal for some target fields to have no matching source. Never create a match just to use a source field or fill every target.",
  "A source field may be selected for at most one target field. A target field may have at most one source field.",
  "Use section or group labels as supporting context. Use field type and accepted options only to avoid clearly incompatible matches.",
  "If no source field clearly represents the same data item as a target field, set source to null for that target. Do not infer matches from order or position. Do not invent fields or values.",
  "Return JSON only as one object with a decisions array. Include every listed target exactly once. Each decision must copy target exactly from the listed target identity and set source either to one listed source identity copied exactly or to null.",
].join(" ")

export function fieldIdentity(label: string, section: string): string {
  return section ? `${label} | section: ${section}` : label
}

function describeSourceField(field: LocalFieldIdentity): string {
  return `- ${field.identity} [type: ${field.type}]`
}

function describeTargetField(field: LocalFieldIdentity): string {
  const options = field.acceptedOptions?.length
    ? ` [accepted options: ${field.acceptedOptions.map((option) => option.label || option.value).filter(Boolean).join(", ")}]`
    : ""
  return `- ${field.identity} [type: ${field.type}]${options}`
}

export function localFieldMatchInput(
  controls: PageControl[],
  candidates: SourceFieldCandidate[],
) {
  const sourceFields: LocalFieldIdentity[] = candidates.map((candidate) => {
    const label = candidate.label_text ?? candidate.information_path
    const section = candidate.group_text ?? ""
    return {
      identity: fieldIdentity(label, section),
      label,
      section,
      type: candidate.type,
    }
  })
  const targetFields: LocalFieldIdentity[] = controls.map((control) => {
    const label = control.label_text ?? control.label
    const section = control.group_text ?? ""
    return {
      identity: fieldIdentity(label, section),
      label,
      section,
      type: control.type,
      acceptedOptions: control.options,
    }
  })
  const text = [
    "Source fields still available:",
    ...sourceFields.map(describeSourceField),
    "",
    "Target fields still needing a match:",
    ...targetFields.map(describeTargetField),
  ].join("\n")
  const indexedText = [
    "Source fields still available:",
    ...sourceFields.map((field, index) => `- s${index + 1}: ${describeSourceField(field).slice(2)}`),
    "",
    "Target fields still needing a match:",
    ...targetFields.map((field, index) => `- t${index + 1}: ${describeTargetField(field).slice(2)}`),
  ].join("\n")
  return { text, indexedText, sourceFields, targetFields }
}
