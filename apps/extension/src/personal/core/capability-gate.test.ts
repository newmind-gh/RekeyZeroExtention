import { describe, expect, it } from "vitest"

import { assertRequestedRoute, routeTask } from "./capability-gate"

const base = {
  task: "field_match" as const,
  destinationFieldCount: 30,
  unresolvedFieldCount: 12,
  contextChars: 12_000,
  sourceItemCount: 3,
  attachmentCount: 0,
  attachmentTypes: [],
  requiresVision: false,
  requiresLongContext: false,
  webgpuAvailable: true,
  localModelReady: true,
  externalProviderEnabled: false,
}

describe("Personal capability gate", () => {
  it("uses Local Lite at the documented boundaries", () => {
    expect(routeTask(base).route).toBe("local_lite")
  })

  it("requires a human beyond local limits without a provider", () => {
    expect(routeTask({ ...base, destinationFieldCount: 31 }).route).toBe("human_required")
    expect(routeTask({ ...base, unresolvedFieldCount: 13 }).route).toBe("human_required")
  })

  it("requires explicit external consent when a provider is available", () => {
    expect(routeTask({
      ...base,
      destinationFieldCount: 31,
      externalProviderEnabled: true,
    })).toEqual({
      route: "external_api",
      reason: "local_capability_exceeded",
      requiresConsent: true,
    })
  })

  it("never sends vision input to Local Lite", () => {
    expect(routeTask({ ...base, requiresVision: true }).route).toBe("unsupported")
  })

  it.each([
    { destinationFieldCount: 31 },
    { unresolvedFieldCount: 13 },
    { contextChars: 12_001 },
  ])("rejects forced Local Lite outside its envelope: $destinationFieldCount fields", (override) => {
    const decision = routeTask({ ...base, ...override })
    expect(() => assertRequestedRoute(decision, "local_lite")).toThrow("outside")
  })

  it("rejects forced Local Lite when the model is disabled or unavailable", () => {
    const decision = routeTask({ ...base, localModelReady: false })
    expect(() => assertRequestedRoute(decision, "local_lite")).toThrow("outside")
  })
})
