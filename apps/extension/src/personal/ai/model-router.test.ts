import { describe, expect, it } from "vitest"

import { LOCAL_FIELD_MATCH_PROMPT, localFieldMatchInput } from "./field-match-prompt"

describe("Local AI field-match input", () => {
  it("renders value-free field metadata and a compact local-model view", () => {
    const input = localFieldMatchInput([{
      control_id: "target-instance-key",
      tag: "input",
      type: "text",
      role: "",
      name: "seller_name",
      label: "Registered business",
      label_text: "Registered business",
      group_text: "Seller details",
      placeholder: "",
      required: false,
      disabled: false,
      current_value: "",
      checked: null,
      options: [],
    }], [{
      information_path: "source-instance-key",
      label_text: "Legal company name",
      group_text: "Verified business profile",
      type: "text",
      value: "Example Commerce Group Pty Ltd",
    }, {
      information_path: "known-source-key",
      label_text: "State",
      group_text: "Address",
      type: "text",
    }])

    expect(input.text).toContain("Source fields still available:")
    expect(input.text).toContain("Legal company name | section: Verified business profile [type: text]")
    expect(input.text).toContain("Target fields still needing a match:")
    expect(input.text).toContain("Registered business | section: Seller details [type: text]")
    expect(input.text).not.toContain("source-instance-key")
    expect(input.text).not.toContain("target-instance-key")
    expect(input.text).not.toContain("Example Commerce Group")
    expect(input.indexedText).toContain("s1: Legal company name | section: Verified business profile [type: text]")
    expect(input.indexedText).toContain("t1: Registered business | section: Seller details [type: text]")
    expect(input.indexedText).not.toContain("source-instance-key")
    expect(input.indexedText).not.toContain("target-instance-key")
    expect(input.indexedText).not.toContain("Example Commerce Group")
    expect(input.sourceFields[0].identity).toBe("Legal company name | section: Verified business profile")
    expect(input.targetFields[0].identity).toBe("Registered business | section: Seller details")
  })

  it("uses one generic target-first prompt with explicit null abstention", () => {
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("For each target field, choose zero or one source field")
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("Many source fields may remain unused")
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("Never create a match just to use a source field")
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("A source field may be selected for at most one target field")
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("A target field may have at most one source field")
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("set source to null")
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("Include every listed target exactly once")
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("Do not infer matches from order or position")
    expect(LOCAL_FIELD_MATCH_PROMPT).toContain("decisions array")
    expect(LOCAL_FIELD_MATCH_PROMPT).not.toContain("known_matches")
    expect(LOCAL_FIELD_MATCH_PROMPT.toLocaleLowerCase()).not.toContain("annual turnover")
  })
})
