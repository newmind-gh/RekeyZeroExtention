import { equal, hash } from "./planner"
import type { Action, Field, Observation, PageCommand, PageReply, Value } from "./types"

const epoch = crypto.randomUUID()
const ids = new WeakMap<Element, string>()
const registry = new Map<string, Element[]>()
let writing = false
const supported = new Set(["text", "email", "tel", "url", "number", "date", "textarea", "select", "checkbox", "radio", "combobox"])
const sensitive = /password|secret|token|credential|credit.?card|card.?number|cvv|cvc|api.?key|one.?time|otp/i
function label(element: Element): string {
  const labels = (element as HTMLInputElement).labels
  const labelled = element.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
  return (element.getAttribute("aria-label") || labelled || (labels && Array.from(labels).map((l) => l.textContent).join(" ")) ||
    element.getAttribute("data-transfer-label") || (element.tagName === "DD" ? element.previousElementSibling?.textContent : "") ||
    element.getAttribute("name") || "").trim()
}
function groupInfo(element: Element): { value: string; recordPath: string } {
  const scopes: string[] = []
  const recordScopes: string[] = []
  let parent: Element | null = element
  while (parent) {
    const key = parent.getAttribute("data-record-id") || parent.getAttribute("data-row-key") || parent.getAttribute("data-transfer-record-id")
    if (key) {
      scopes.unshift(`Record ${key}`)
      recordScopes.unshift(key)
    }
    else if (parent.tagName === "TR") {
      if (!ids.has(parent)) ids.set(parent, crypto.randomUUID())
      scopes.unshift(`Row ${ids.get(parent)!.slice(0, 8)}`)
    }
    else if (parent.tagName === "FIELDSET") scopes.unshift(parent.querySelector(":scope > legend")?.textContent?.trim() || "Unnamed section")
    else if (parent.tagName === "FORM" && (parent.getAttribute("aria-label") || parent.id)) scopes.unshift(parent.getAttribute("aria-label") || parent.id)
    parent = parent.parentElement
  }
  return { value: scopes.join(" / "), recordPath: recordScopes.join(" / ") }
}
const group = (element: Element) => groupInfo(element).value
function positionalName(value: string): { normalized: string; strong: boolean } {
  const bracketed = value.replace(/\[\d+\]/g, "[]")
  const dotted = bracketed.replace(/\.\d+(?=\.|$)/g, "[]")
  const normalized = dotted.replace(/_\d+(?=_|$)/g, "[]")
  return { normalized, strong: bracketed !== value || dotted !== bracketed }
}
function visible(element: Element): boolean {
  return !element.closest('[hidden], [inert], [aria-hidden="true"]') && Boolean(element.getClientRects().length) &&
    getComputedStyle(element).visibility !== "hidden"
}
function eligible(element: Element): boolean {
  const input = element as HTMLInputElement
  if (element.matches('[role="combobox"]')) return visible(element) &&
    !sensitive.test(`${element.getAttribute("aria-label")} ${element.getAttribute("aria-labelledby")}`)
  return visible(element) && !["hidden", "password", "submit", "reset", "button", "image", "search"].includes(input.type) &&
    !sensitive.test(`${input.type} ${input.name} ${input.id} ${label(element)} ${element.getAttribute("autocomplete")}`)
}
function identityEvidence(fields: Field[]) {
  const evidence: Observation["identityEvidence"] = []
  const seen = new Set<string>()
  const add = (kind: string, label: string, raw: string | null | undefined, confidence: "high" | "medium") => {
    const value = raw?.trim()
    const identity = `${kind}:${label}:${value}`
    if (!value || seen.has(identity)) return
    seen.add(identity)
    evidence.push({ kind, label, value: value.slice(0, 200), confidence })
  }
  for (const name of ["record", "customer", "application", "order", "account", "project"]) {
    for (const element of document.querySelectorAll(`[data-${name}-id]`)) {
      add("attribute", `${name} ID`, element.getAttribute(`data-${name}-id`), "high")
    }
  }
  for (const [attribute, label] of [["data-row-key", "row key"], ["data-transfer-record-id", "adapter record ID"]]) {
    for (const element of document.querySelectorAll(`[${attribute}]`)) {
      add("attribute", label, element.getAttribute(attribute), "high")
    }
  }
  const identityLabel = /^(company name|legal company name|organisation name|organization name|customer name|customer id|record id|application id|order id|order reference|account id|project id|公司名称|客户编号|申请编号|订单编号)$/i
  for (const field of fields.filter((candidate) => identityLabel.test(candidate.label) && !candidate.writable)) {
    // Writable values are transfer payload, not trustworthy record identity. Including
    // them would make the identity change while a blank form is being filled.
    add("field", field.label, String(field.value ?? ""), "high")
  }
  const textPattern = /\b(order|application|customer|record|account|project)\s*(?:id|number|no\.?|reference|ref\.?)?\s*[:#-]\s*([A-Z0-9][A-Z0-9_-]{3,})\b/gi
  for (const element of document.querySelectorAll('h1,h2,h3,header,[role="heading"],[data-record-label],dt,th,[class*="reference" i],[class*="order" i],[class*="record" i],[class*="application" i]')) {
    const text = element.textContent?.replace(/\s+/g, " ").trim() ?? ""
    for (const match of text.matchAll(textPattern)) add("heading", `${match[1]} reference`, match[2], "high")
    const standalone = text.match(/\b(?:Q|APP|CASE|POL|REF)-[A-Z0-9_-]{3,}\b/i)?.[0]
    if (standalone) add("heading", "Page reference", standalone, "high")
  }
  return evidence
}
function value(elements: Element[]): Value {
  const first = elements[0]
  if (first.matches('[role="combobox"]')) return first.getAttribute("data-rekeyzero-value") ?? null
  if (first instanceof HTMLInputElement && first.type === "radio") return (elements as HTMLInputElement[]).find((e) => e.checked)?.value ?? null
  if (first instanceof HTMLInputElement && first.type === "checkbox") return first.checked
  if (first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement || first instanceof HTMLSelectElement) return first.value
  return first.textContent?.trim() ?? ""
}
function comboboxOptions(element: Element): Field["options"] {
  if (!element.matches('[role="combobox"][data-rekeyzero-control="listbox"]')) return []
  const raw = element.getAttribute("data-rekeyzero-options")
  if (!raw || raw.length > 20_000) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, 200).flatMap((item) => item && typeof item === "object" &&
      typeof (item as { value?: unknown }).value === "string" && typeof (item as { label?: unknown }).label === "string"
      ? [{ value: (item as { value: string }).value, label: (item as { label: string }).label }] : [])
  } catch { return [] }
}
export async function observeTransferPage(): Promise<Observation> {
  const all = Array.from(document.querySelectorAll("input, textarea, select, dd, [data-transfer-label], [role=combobox], [contenteditable=true]"))
  const candidates = all.filter((e) => e.isConnected && eligible(e))
  const fields: Field[] = []
  const identityFlags = new Map<string, { positional: boolean; strong: boolean; recordPath: string; family: string }>()
  const radioSeen = new Set<Element>()
  registry.clear()
  for (const element of candidates.slice(0, 120)) {
    if (radioSeen.has(element)) continue
    let elements = [element]
    const input = element as HTMLInputElement
    const adaptedCombobox = element.matches('[role="combobox"][data-rekeyzero-control="listbox"]')
    const type = adaptedCombobox ? "combobox" : element.matches('[role="combobox"]') ? "custom_combobox" :
      element instanceof HTMLInputElement ? input.type : element.tagName.toLowerCase()
    if (type === "radio") {
      if (!input.name) elements = [element]
      else elements = candidates.filter((e) => e instanceof HTMLInputElement && e.type === "radio" && e.name === input.name && e.form === input.form && group(e) === group(element))
      elements.forEach((e) => radioSeen.add(e))
    }
    if (!ids.has(element)) ids.set(element, crypto.randomUUID())
    const id = ids.get(element)!
    registry.set(id, elements)
    const scope = groupInfo(element)
    const fieldGroup = scope.value
    const fieldLabel = type === "radio" ? element.closest("fieldset")?.querySelector(":scope > legend")?.textContent?.trim() || input.name || label(element) : label(element)
    const locator = element.getAttribute("name") || element.id || fieldLabel
    const options = adaptedCombobox ? comboboxOptions(element) : element instanceof HTMLSelectElement ? Array.from(element.options).filter((o) => !o.disabled && !(o.parentElement instanceof HTMLOptGroupElement && o.parentElement.disabled)).map((o) => ({ value: o.value, label: o.label })) :
      type === "radio" ? (elements as HTMLInputElement[]).filter((e) => !e.disabled).map((e) => ({ value: e.value, label: label(e) })) : []
    const raw = value(elements)
    const templateGroup = fieldGroup.replace(/Record [^/]+/g, "Record").replace(/Row [^/]+/g, "Row")
    const positional = positionalName(locator)
    const positionalField = positional.normalized !== locator
    const templateKey = await hash([templateGroup, positional.normalized, type])
    const instanceKey = await hash([fieldGroup, positionalField ? positional.normalized : locator, type])
    const family = JSON.stringify([scope.recordPath, positional.normalized, type])
    identityFlags.set(id, { positional: positionalField, strong: positional.strong, recordPath: scope.recordPath, family })
    fields.push({ id, templateKey, instanceKey,
      templateStable: Boolean(locator), instanceStable: Boolean(locator && !fieldGroup.includes("Row ")), ambiguousInObservation: false,
      label: fieldLabel || "Unnamed field", group: fieldGroup, type, value: raw,
      display: options.find((o) => o.value === raw)?.label ?? String(raw ?? "Not selected"), options,
      required: elements.some((e) => (e as HTMLInputElement).required),
      writable: supported.has(type) && (adaptedCombobox || !element.hasAttribute("role")) && elements.every((e) => !(e as HTMLInputElement).disabled && !(e as HTMLInputElement).readOnly && !e.matches(":disabled") && e.getAttribute("aria-disabled") !== "true") && !(element instanceof HTMLSelectElement && element.multiple),
      reusable: Boolean(locator && !fieldGroup.includes("Row ")) })
  }
  const templateCounts = new Map<string, number>()
  const instanceCounts = new Map<string, number>()
  const familyCounts = new Map<string, number>()
  fields.forEach((field) => {
    templateCounts.set(field.templateKey, (templateCounts.get(field.templateKey) ?? 0) + 1)
    instanceCounts.set(field.instanceKey, (instanceCounts.get(field.instanceKey) ?? 0) + 1)
    const family = identityFlags.get(field.id)!.family
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)
  })
  fields.forEach((f) => {
    f.ambiguousInObservation = templateCounts.get(f.templateKey)! > 1
    if (f.ambiguousInObservation) f.reusable = false
    if (instanceCounts.get(f.instanceKey)! > 1) f.instanceStable = false
    const flags = identityFlags.get(f.id)!
    if (flags.positional && ((!flags.recordPath && flags.strong) || familyCounts.get(flags.family)! > 1)) f.instanceStable = false
  })
  const template = await hash([location.origin, fields.map((f) => [f.templateKey, f.type]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))])
  const structure = await hash([location.href, fields.map((f) => [f.instanceKey, f.id, f.type, f.writable, f.options])])
  const identityFields = fields.filter((f) => /^(company name|legal company name|organisation name|organization name|customer name|customer id|record id|application id|公司名称|客户编号)$/i.test(f.label))
  const recordValues = Object.fromEntries(identityFields.map((f) => [f.id, f.value]))
  const evidence = identityEvidence(fields)
  const identityConfidence: Observation["identityConfidence"] = evidence.some((item) => item.confidence === "high") ? "high" :
    evidence.length ? "medium" : fields.filter((field) => field.writable).every((field) => field.value === "" || field.value === null || field.value === false) ? "new_form" : "uncertain"
  const pageIdentity = await hash([location.href, document.title, evidence.map((item) => [item.kind, item.label, item.value])])
  const identity = pageIdentity
  return { epoch, identity, pageIdentity, identityEvidence: evidence, identityConfidence, template, structure, origin: location.origin, title: document.title, fields,
    recordValues,
    blockedReason: Array.from(document.querySelectorAll('input[type="password"]')).some(visible) || /\b(log\s?in|sign\s?in|authentication)\b/i.test(document.title)
      ? "Please sign in and open the intended form before filling" : undefined,
    scannedCount: all.length, eligibleCount: candidates.length, truncated: candidates.length > 120 }
}
async function setValue(elements: Element[], expected: Value) {
  const first = elements[0]
  if (first.matches('[role="combobox"][data-rekeyzero-control="listbox"]')) {
    if (typeof expected !== "string") throw new Error("Combobox requires a string option value")
    const listboxId = first.getAttribute("aria-controls")
    if (!listboxId) throw new Error("Combobox adapter is missing its listbox identity")
    ;(first as HTMLElement).click()
    let option: HTMLElement | undefined
    for (let attempt = 0; attempt < 20 && !option; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 25))
      option = Array.from(document.getElementById(listboxId)?.querySelectorAll<HTMLElement>('[role="option"][data-rekeyzero-value]') ?? [])
        .find((candidate) => candidate.getAttribute("data-rekeyzero-value") === expected)
    }
    if (!option) throw new Error("Combobox did not expose the reviewed option")
    option.click()
  } else if (first instanceof HTMLInputElement && first.type === "radio") {
    for (const e of elements as HTMLInputElement[]) Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")!.set!.call(e, e.value === expected)
  } else if (first instanceof HTMLInputElement && first.type === "checkbox") {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")!.set!.call(first, expected)
  } else {
    const prototype = first instanceof HTMLSelectElement ? HTMLSelectElement.prototype : first instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(first, expected ?? "")
  }
  if (!first.matches('[role="combobox"]')) {
    const changed = first instanceof HTMLInputElement && first.type === "radio" ? elements.find((e) => (e as HTMLInputElement).value === expected)! : first
    changed.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
    changed.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
  }
}
const invalid = (elements: Element[]) => elements.some((element) => {
  const validity = (element as HTMLInputElement).validity
  return (validity ? !validity.valid : false) || element.getAttribute("aria-invalid") === "true"
})
async function apply(request: PageCommand): Promise<Action> {
  const plan = request.plan!
  const action = plan.actions.find((a) => a.id === request.actionId)
  if (!action || action.status !== "ready") throw new Error("Invalid fill action")
  const current = await observeTransferPage()
  if (plan.epoch !== epoch || plan.identity !== current.identity || plan.template !== current.template || plan.structure !== current.structure) return { ...action, status: "stale", reason: "Page identity or structure changed; review this target" }
  const recordMatches = (observation: Observation) => Object.entries(plan.recordValues ?? {}).every(([id, before]) =>
    equal(observation.recordValues?.[id] ?? null, before) || (id === action.field.id && equal(observation.recordValues?.[id] ?? null, action.expected)))
  if (!recordMatches(current)) return { ...action, status: "stale", reason: "Target customer identity changed" }
  const field = current.fields.find((f) => f.id === action.field.id)
  const elements = registry.get(action.field.id)
  if (!field?.writable || !elements || field.type !== action.field.type) return { ...action, status: "unsupported", reason: "Control is unavailable or not editable" }
  if (equal(field.value, action.expected)) {
    const markedInvalid = invalid(elements)
    return { ...action, status: markedInvalid ? "validation_failed" : "already_equal", observed: field.value, reason: markedInvalid ? "Current value is marked invalid" : "Read-back already matches" }
  }
  if (!equal(field.value, action.before)) return { ...action, status: "stale", observed: field.value, reason: "Value changed after preparation" }
  if (request.operation === "read") return { ...action, status: "ready", observed: field.value, reason: "Original value still present; safe to retry" }
  if (field.options.length && !field.options.some((o) => o.value === action.expected)) return { ...action, status: "stale", reason: "Accepted options changed" }
  writing = true
  try {
    await setValue(elements, action.expected)
    let observed = value(elements)
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, 150))
      observed = value(elements)
      if (!elements.every((e) => e.isConnected)) return { ...action, status: "unknown", observed, reason: "Control was replaced; re-observe before retry" }
    }
    const markedInvalid = invalid(elements)
    const after = await observeTransferPage()
    if (after.identity !== plan.identity || after.epoch !== plan.epoch || !recordMatches(after)) return { ...action, observed, status: "unknown", reason: "Page identity changed during write" }
    return { ...action, observed, status: equal(observed, action.expected) && !markedInvalid ? "filled_verified" : "validation_failed",
      reason: equal(observed, action.expected) && !markedInvalid ? "Filled and checked on page" : "Page rejected, reverted or marked this value invalid" }
  } catch (error) {
    return { ...action, status: "validation_failed", reason: error instanceof Error ? error.message : "Control rejected value" }
  } finally { writing = false }
}
export async function handleTransferPage(request: PageCommand): Promise<PageReply> {
  const envelope = { transferId: request.transferId, targetId: request.targetId, tabId: request.tabId,
    documentEpoch: epoch, requestId: request.requestId }
  try {
    if (request.documentEpoch && request.documentEpoch !== epoch) throw new Error("Document changed")
    if (request.operation === "observe") return { ok: true, envelope, observation: await observeTransferPage() }
    if (request.operation === "apply" || request.operation === "read") return { ok: true, envelope, action: await apply(request) }
    throw new Error("Unsupported transfer page operation")
  } catch (error) { return { ok: false, envelope, error: error instanceof Error ? error.message : "Page operation failed" } }
}
