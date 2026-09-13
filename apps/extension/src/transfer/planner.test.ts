import { describe, expect, it } from "vitest"
import { equal, hash, normalize, planTransfer, snapshot } from "./planner"
import type { Field, Observation, Snapshot } from "./types"

const field = (id: string, label: string, value = "", extra: Partial<Field> = {}): Field => ({
  id, templateKey: id, instanceKey: id, templateStable: true, instanceStable: true, ambiguousInObservation: false,
  label, value, display: value, group: "", type: "text", options: [], required: false, writable: true, reusable: true, ...extra,
})
const observation = (fields: Field[]): Observation => ({ epoch: "epoch", identity: "record", pageIdentity: "record", identityEvidence: [], identityConfidence: "new_form", template: "template", structure: "structure", origin: "https://example.test", title: "Form", fields, scannedCount: fields.length, eligibleCount: fields.length, truncated: false })
const source = (fields: Field[]): Snapshot => ({ ...observation(fields), id: "snapshot", hash: "hash", group: "", availableGroups: [], capturedAt: "today" })

describe("non-AI transfer planning", () => {
  it("retains Unicode and rejects empty or ambiguous identities and different revenue definitions", () => {
    expect(normalize("公司 名称")).toBe("公司名称")
    const plan = planTransfer(source([field("s1", "公司名称", "Example Ltd"), field("s2", "Address", "One"), field("s3", "Address", "Two"), field("s4", "Annual revenue", "100"), field("s5", "!!!", "unsafe")]),
      observation([field("t1", "Company name"), field("t2", "Address"), field("t3", "Projected turnover"), field("t4", "???")]), {}, 1)
    expect(plan.actions.map((a) => a.status)).toEqual(["unmapped", "unmapped", "unmapped", "unmapped"])
  })
  it("distinguishes empty, zero, false and unselected radio values", () => {
    expect(equal(null, false)).toBe(false)
    expect(equal("0", false)).toBe(false)
    const plan = planTransfer(source([field("s", "Enabled", "", { type: "checkbox", value: false }), field("zero", "Count", "0")]),
      observation([field("t", "Enabled", "", { type: "checkbox", value: true }), field("n", "Count", "", { type: "number" })]), {}, 1)
    expect(plan.actions[0]).toMatchObject({ expected: false, status: "preserved_existing" })
    expect(plan.actions[1]).toMatchObject({ expected: "0", status: "ready" })
  })
  it("binds overwrites to the exact value the user reviewed", () => {
    const src = source([field("s", "Name", "New")])
    const dst = observation([field("t", "Name", "Existing")])
    expect(planTransfer(src, dst, {}, 1).actions[0].status).toBe("preserved_existing")
    expect(planTransfer(src, dst, { t: { mode: "overwrite", before: "Existing" } }, 1).actions[0].status).toBe("ready")
    dst.fields[0].value = "User edit"
    expect(planTransfer(src, dst, { t: { mode: "overwrite", before: "Existing" } }, 1).actions[0].status).toBe("preserved_existing")
  })
  it("requires compatible dates and enums while matching unique labels across system groups", () => {
    const src = source([field("s", "Date", "01/02/2026"), field("state", "State", "NSW"), field("address", "Address", "Road", { group: "Postal" })])
    const dst = observation([field("date", "Date", "", { type: "date" }), field("region", "State", "", { type: "select", options: [{ label: "New South Wales", value: "AU-NSW" }] }), field("a", "Address", "", { group: "Business" }), field("optional", "Optional extra")])
    expect(planTransfer(src, dst, {}, 1).actions.map((a) => a.status)).toEqual(["unsupported", "ready", "ready", "unmapped"])
  })
  it("uses explicit profile decisions for differently named cross-system fields", () => {
    const src = source([
      field("company", "Legal company name", "Example Pty Ltd"),
      field("email", "Contact email", "team@example.test"),
      field("turnover", "Annual turnover", "1000", { type: "number" }),
      field("state", "State", "NSW"),
      field("date", "Account start date", "2026-10-01", { type: "date" }),
      field("description", "Business description", "Consulting"),
    ])
    const dst = observation([
      field("applicant", "Registered business", "", { group: "Seller details" }),
      field("work-email", "Operations email", "", { group: "Seller details" }),
      field("sales", "Estimated annual sales", "", { group: "Seller details", type: "number" }),
      field("registered-state", "Registered region", "", { group: "Seller details" }),
      field("start-date", "Store launch date", "", { group: "Seller details", type: "date" }),
      field("summary", "Business summary", "", { group: "Seller details" }),
    ])
    const sourceIds = ["company", "email", "turnover", "state", "date", "description"]
    const decisions = Object.fromEntries(dst.fields.map((targetField, index) => [targetField.instanceKey, { sourceInstanceKey: sourceIds[index] }]))
    expect(planTransfer(src, dst, decisions, 1).actions.every((action) => action.status === "ready")).toBe(true)
  })
  it("does not treat an adapted combobox without current options as free text", () => {
    const src = source([field("category-source", "Business category", "Marketplace seller")])
    const dst = observation([field("category-target", "Business category", "", { type: "combobox", options: [] })])
    expect(planTransfer(src, dst, {}, 1).actions[0]).toMatchObject({
      expected: null,
      status: "unsupported",
      reason: "No accepted options are currently available; fill prerequisite fields first",
    })
  })
  it("hashes the actual snapshot values, including false and zero", async () => {
    expect(await hash({ b: 2, a: { z: false, x: "0" } })).toBe(await hash({ a: { x: "0", z: false }, b: 2 }))
    const first = await snapshot(observation([field("s", "Count", "0")]))
    const same = await snapshot(observation([field("s", "Count", "0")]))
    const changed = await snapshot(observation([field("s", "Count", "1")]))
    expect(first.hash).toBe(same.hash)
    expect(first.hash).not.toBe(changed.hash)
  })
  it("restores mapping reuse after one repeated record group is explicitly selected", async () => {
    const repeated = observation([
      field("a", "Company name", "First", { templateKey: "company", instanceKey: "company-a", group: "Record A", reusable: false, ambiguousInObservation: true }),
      field("b", "Company name", "Second", { templateKey: "company", instanceKey: "company-b", group: "Record B", reusable: false, ambiguousInObservation: true }),
    ])
    const selected = await snapshot(repeated, "Record B")
    expect(selected.fields).toHaveLength(1)
    expect(selected.fields[0]).toMatchObject({ value: "Second", reusable: true, ambiguousInObservation: true })
  })
  it("keeps repeated target decisions attached to their stable record instances", () => {
    const src = source([field("source", "Address", "Replacement")])
    const dst = observation([
      field("a", "Address", "Existing A", { templateKey: "address", instanceKey: "record-a-address", group: "Record A", reusable: false }),
      field("b", "Address", "Existing B", { templateKey: "address", instanceKey: "record-b-address", group: "Record B", reusable: false }),
    ])
    const decisions = {
      "record-a-address": { sourceInstanceKey: "source", mode: "overwrite" as const, before: "Existing A" },
      "record-b-address": { mode: "preserve" as const, before: "Existing B" },
    }
    const plan = planTransfer(src, dst, decisions, 1)
    expect(plan.actions.map((action) => [action.field.instanceKey, action.status])).toEqual([
      ["record-a-address", "ready"],
      ["record-b-address", "preserved_existing"],
    ])
  })
})
