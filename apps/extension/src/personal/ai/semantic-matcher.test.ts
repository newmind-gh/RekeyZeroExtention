import { describe, expect, it } from "vitest"

import type { PageControl } from "../../shared/types"
import { basicTypeCompatible, exactFieldMatches, normalizeLabel, validateFieldMatches } from "./semantic-matcher"

const control = (control_id: string, label: string, type = "text"): PageControl => ({
  control_id, tag: "input", type, role: "", name: "", label, label_text: label,
  group_text: "", placeholder: "", required: false, disabled: false,
  current_value: "", checked: null, options: [],
})

describe("Personal semantic matcher", () => {
  it("normalizes Unicode, case, whitespace, and punctuation for exact matches", () => {
    expect(normalizeLabel("  COMPANY—Name  ")).toBe("company name")
    expect(exactFieldMatches([control("target", " company-name ")], [
      { information_path: "source", label_text: "COMPANY NAME", type: "text" },
    ])).toEqual([{ control_id: "target", information_path: "source" }])
  })

  it("leaves ambiguous exact labels unresolved", () => {
    expect(exactFieldMatches([control("target", "Email")], [
      { information_path: "one", label_text: "Email", type: "email" },
      { information_path: "two", label_text: "Email", type: "email" },
    ])).toEqual([])
    expect(exactFieldMatches([control("unknown", "Unrelated destination")], [
      { information_path: "source", label_text: "Different source", type: "text" },
    ])).toEqual([])
    expect(exactFieldMatches([
      control("contact-a", "Email", "email"),
      control("contact-b", " email ", "email"),
    ], [
      { information_path: "source", label_text: "EMAIL", type: "email" },
    ])).toEqual([])
  })

  it("checks target ambiguity against the complete page, not only eligible controls", () => {
    expect(exactFieldMatches(
      [control("eligible", "Email", "email")],
      [{ information_path: "source", label_text: "Email", type: "email" }],
      [control("eligible", "Email", "email"), { ...control("unsupported", "Email", "email"), disabled: true }],
    )).toEqual([])
  })

  it("is independent of source and target DOM order", () => {
    const controls = [control("company-target", "Company"), control("email-target", "Email", "email")]
    const candidates = [
      { information_path: "company-source", label_text: "Company", type: "text" },
      { information_path: "email-source", label_text: "Email", type: "email" },
    ]
    const expected = exactFieldMatches(controls, candidates).sort((a, b) => a.control_id.localeCompare(b.control_id))
    const shuffled = exactFieldMatches([...controls].reverse(), [...candidates].reverse())
      .sort((a, b) => a.control_id.localeCompare(b.control_id))
    expect(shuffled).toEqual(expected)
  })

  it("uses generic type families", () => {
    expect(basicTypeCompatible("email", "text")).toBe(true)
    expect(basicTypeCompatible("text", "number")).toBe(true)
    expect(basicTypeCompatible("number", "text")).toBe(true)
    expect(basicTypeCompatible("text", "date")).toBe(true)
    expect(basicTypeCompatible("date", "text")).toBe(true)
    expect(basicTypeCompatible("date", "checkbox")).toBe(false)
  })

  it("rejects all competing target mappings and incompatible mappings", () => {
    const result = validateFieldMatches([
      { control_id: "duplicate", information_path: "text-a" },
      { control_id: "duplicate", information_path: "text-b" },
      { control_id: "boolean", information_path: "text-a" },
    ], [control("duplicate", "Name"), control("boolean", "Enabled", "checkbox")], [
      { information_path: "text-a", label_text: "Name", type: "text" },
      { information_path: "text-b", label_text: "Other", type: "text" },
    ])
    expect(result.accepted).toEqual([])
    expect(result.rejected.map((item) => item.reason)).toEqual([
      "duplicate_target", "duplicate_target", "duplicate_source",
    ])
    expect(validateFieldMatches(
      [{ control_id: "invented", information_path: "text-a" }],
      [control("known", "Name")],
      [{ information_path: "text-a", label_text: "Name", type: "text" }],
    ).rejected[0].reason).toBe("invalid_reference")
  })

  it("rejects a source field reused for multiple targets on one target page", () => {
    const result = validateFieldMatches([
      { control_id: "one", information_path: "source" },
      { control_id: "two", information_path: "source" },
    ], [control("one", "First"), control("two", "Second")], [
      { information_path: "source", label_text: "Source", type: "text" },
    ])
    expect(result.accepted).toEqual([])
    expect(result.rejected.map((item) => item.reason)).toEqual(["duplicate_source", "duplicate_source"])
  })
})
