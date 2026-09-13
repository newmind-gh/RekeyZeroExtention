export type CapabilityInput = {
  task: "field_match" | "short_extract" | "exception_explain"
  destinationFieldCount: number
  unresolvedFieldCount: number
  contextChars: number
  sourceItemCount: number
  attachmentCount: number
  attachmentTypes: string[]
  requiresVision: boolean
  requiresLongContext: boolean
  webgpuAvailable: boolean
  localModelReady: boolean
  externalProviderEnabled: boolean
}

export type CapabilityDecision =
  | { route: "deterministic" }
  | { route: "local_lite"; reason: string }
  | { route: "external_api"; reason: string; requiresConsent: true }
  | { route: "human_required"; reason: string }
  | { route: "unsupported"; reason: string }

export type CapabilityLimits = {
  localDestinationFields: number
  localUnresolvedFields: number
  localContextChars: number
  localSourceItems: number
  localDestinationPages: number
  externalDestinationFields: number
  externalContextChars: number
  externalSourceItems: number
}

export const DEFAULT_CAPABILITY_LIMITS: CapabilityLimits = {
  localDestinationFields: 30,
  localUnresolvedFields: 12,
  localContextChars: 12_000,
  localSourceItems: 3,
  localDestinationPages: 5,
  externalDestinationFields: 80,
  externalContextChars: 60_000,
  externalSourceItems: 8,
}

export function routeTask(
  input: CapabilityInput,
  limits: CapabilityLimits = DEFAULT_CAPABILITY_LIMITS,
): CapabilityDecision {
  if (input.unresolvedFieldCount === 0) return { route: "deterministic" }
  const unsupportedMedia = input.requiresVision
    || input.attachmentTypes.includes("large_pdf")
  if (unsupportedMedia) {
    return input.externalProviderEnabled
      ? { route: "external_api", reason: "unsupported_local_media", requiresConsent: true }
      : { route: "unsupported", reason: "unsupported_local_media" }
  }
  const withinLocalLimits = input.destinationFieldCount <= limits.localDestinationFields
    && input.unresolvedFieldCount <= limits.localUnresolvedFields
    && input.contextChars <= limits.localContextChars
    && input.sourceItemCount <= limits.localSourceItems
    && input.attachmentCount === 0
  if (
    input.webgpuAvailable
    && input.localModelReady
    && withinLocalLimits
    && !input.requiresLongContext
  ) return { route: "local_lite", reason: "within_local_limits" }

  const withinExternalLimits = input.destinationFieldCount <= limits.externalDestinationFields
    && input.contextChars <= limits.externalContextChars
    && input.sourceItemCount <= limits.externalSourceItems
  if (input.externalProviderEnabled && withinExternalLimits) {
    return { route: "external_api", reason: "local_capability_exceeded", requiresConsent: true }
  }
  return {
    route: withinExternalLimits ? "human_required" : "unsupported",
    reason: withinExternalLimits ? "local_capability_exceeded" : "personal_capability_exceeded",
  }
}

export function assertRequestedRoute(
  decision: CapabilityDecision,
  requestedRoute: "local_lite" | "external_api",
): void {
  if (decision.route !== requestedRoute) {
    throw new Error("Requested AI route is outside the supported capability envelope")
  }
}
