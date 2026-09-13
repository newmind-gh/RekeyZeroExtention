import type { PageControl } from "../../shared/types"

export type SourceFieldCandidate = {
  information_path: string
  label_text?: string
  group_text?: string
  type: string
  value?: unknown
}

export type StableFieldMatch = { control_id: string; information_path: string }
export type RejectedFieldMatch = StableFieldMatch & {
  reason: "invalid_reference" | "duplicate_target" | "duplicate_source" | "unsupported_target" | "incompatible_type"
}

const SUPPORTED_TARGET_TYPES = new Set([
  "text", "email", "tel", "url", "number", "date", "textarea",
  "select", "checkbox", "radio", "combobox",
])

function typeFamily(type: string): "text" | "number" | "date" | "boolean" | "options" | "unknown" {
  const normalized = type.toLocaleLowerCase()
  if (["text", "email", "tel", "url", "search", "textarea", "dd", "div", "output"].includes(normalized)) return "text"
  if (["number", "range"].includes(normalized)) return "number"
  if (["date", "datetime-local", "month", "week", "time"].includes(normalized)) return "date"
  if (normalized === "checkbox") return "boolean"
  if (["select", "select-one", "radio", "combobox"].includes(normalized)) return "options"
  return "unknown"
}

export function normalizeLabel(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ")
}

export function basicTypeCompatible(sourceType: string, targetType: string): boolean {
  const source = typeFamily(sourceType)
  const target = typeFamily(targetType)
  if (source === "unknown" || target === "unknown") return false
  if (source === "boolean" || target === "boolean") return source === target
  return true
}

export function exactFieldMatches(
  controls: PageControl[],
  candidates: SourceFieldCandidate[],
  allTargetControls: PageControl[] = controls,
): StableFieldMatch[] {
  const targetLabelCounts = new Map<string, number>()
  allTargetControls.forEach((control) => {
    const label = normalizeLabel(control.label_text ?? control.label)
    if (label) targetLabelCounts.set(label, (targetLabelCounts.get(label) ?? 0) + 1)
  })
  return controls.flatMap((control) => {
    if (control.disabled || !SUPPORTED_TARGET_TYPES.has(control.type.toLocaleLowerCase())) return []
    const targetLabel = normalizeLabel(control.label_text ?? control.label)
    if (!targetLabel || targetLabelCounts.get(targetLabel) !== 1) return []
    const matching = candidates.filter((candidate) =>
      normalizeLabel(candidate.label_text ?? candidate.information_path) === targetLabel
      && basicTypeCompatible(candidate.type, control.type))
    return matching.length === 1
      ? [{ control_id: control.control_id, information_path: matching[0].information_path }]
      : []
  })
}

export function validateFieldMatches(
  proposals: StableFieldMatch[], controls: PageControl[], candidates: SourceFieldCandidate[],
): { accepted: StableFieldMatch[]; rejected: RejectedFieldMatch[] } {
  const controlsById = new Map(controls.map((control) => [control.control_id, control]))
  const candidatesByPath = new Map(candidates.map((candidate) => [candidate.information_path, candidate]))
  const targetCounts = new Map<string, number>()
  const sourceCounts = new Map<string, number>()
  proposals.forEach((proposal) => {
    targetCounts.set(proposal.control_id, (targetCounts.get(proposal.control_id) ?? 0) + 1)
    sourceCounts.set(proposal.information_path, (sourceCounts.get(proposal.information_path) ?? 0) + 1)
  })

  const accepted: StableFieldMatch[] = []
  const rejected: RejectedFieldMatch[] = []
  for (const proposal of proposals) {
    const control = controlsById.get(proposal.control_id)
    const candidate = candidatesByPath.get(proposal.information_path)
    let reason: RejectedFieldMatch["reason"] | null = null
    if (!control || !candidate) reason = "invalid_reference"
    else if ((targetCounts.get(proposal.control_id) ?? 0) > 1) reason = "duplicate_target"
    else if ((sourceCounts.get(proposal.information_path) ?? 0) > 1) reason = "duplicate_source"
    else if (control.disabled || !SUPPORTED_TARGET_TYPES.has(control.type.toLocaleLowerCase())) reason = "unsupported_target"
    else if (!basicTypeCompatible(candidate.type, control.type)) reason = "incompatible_type"
    const stable = {
      control_id: proposal.control_id,
      information_path: proposal.information_path,
    }
    if (reason) rejected.push({ ...stable, reason })
    else accepted.push(stable)
  }
  return { accepted, rejected }
}
