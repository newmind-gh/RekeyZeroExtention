import { describe, expect, it } from "vitest"
import { pagePathPattern } from "./store"

describe("Mapping Profile page paths", () => {
  it("stores only path shape without embedding route or customer identifiers", () => {
    expect(pagePathPattern("https://portal.test/customers/12345?view=edit")).toBe("/:segment/:segment")
    expect(pagePathPattern("https://portal.test/orders/550e8400-e29b-41d4-a716-446655440000")).toBe("/:segment/:segment")
    expect(pagePathPattern("https://portal.test/forms/new")).toBe("/:segment/:segment")
  })
})
