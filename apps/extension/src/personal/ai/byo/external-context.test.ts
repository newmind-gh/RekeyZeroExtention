import { describe, expect, it } from "vitest"

import { externalModelInput, minimumFieldMatchContext } from "./external-context"
import { assertExternalProviderContext } from "../model-router"

describe("BYO minimum-context envelope", () => {
  it("sanitizes controls, selects relevant facts, and sends the reviewed envelope", () => {
    const controlsWithPrivateRuntimeState = [{
      control_id: "email",
      label: "Customer Email",
      type: "email",
      current_value: "secret already on page",
      placeholder: "private placeholder",
    }]
    const envelope = minimumFieldMatchContext({
      providerId: "provider_1",
      providerName: "My AI Provider",
      providerBaseUrl: "https://provider.example.test/v1",
      providerModel: "model-a",
      controls: controlsWithPrivateRuntimeState,
      candidates: [
        { information_path: "contact.email", value: "maya@example.test" },
        { information_path: "identity.date_of_birth", value: "1990-01-01" },
      ],
      neverSendInformationPaths: [],
    })

    expect(envelope.controls).toEqual([{ control_id: "email", label: "Customer Email", type: "email" }])
    expect(envelope.candidates).toEqual([
      { information_path: "contact.email", value: "maya@example.test" },
    ])
    expect(JSON.stringify(envelope)).not.toContain("secret already on page")
    expect(JSON.stringify(envelope)).not.toContain("private placeholder")
    expect(externalModelInput(envelope)).toBe(envelope)
  })

  it("honours never-send paths before building the immutable envelope", () => {
    const envelope = minimumFieldMatchContext({
      providerId: "provider_1",
      providerName: "My AI Provider",
      providerBaseUrl: "https://provider.example.test/v1",
      providerModel: "model-a",
      controls: [{ control_id: "email", label: "Email", type: "email" }],
      candidates: [{ information_path: "contact.email", value: "private@example.test" }],
      neverSendInformationPaths: ["contact.email"],
    })
    expect(envelope.candidates).toEqual([])
    expect(JSON.stringify(envelope)).not.toContain("contact.email")
    expect(JSON.stringify(envelope)).not.toContain("private@example.test")
    expect(Object.isFrozen(envelope)).toBe(true)
  })

  it("limits relevant facts to five candidates per unresolved control", () => {
    const envelope = minimumFieldMatchContext({
      providerId: "provider_1",
      providerName: "My AI Provider",
      providerBaseUrl: "https://provider.example.test/v1",
      providerModel: "model-a",
      controls: [{ control_id: "email", label: "Customer Email", type: "email" }],
      candidates: Array.from({ length: 10 }, (_, index) => ({
        information_path: `contacts.email_${index}`,
        value: `person${index}@example.test`,
      })),
      neverSendInformationPaths: [],
    })
    expect(envelope.candidates).toHaveLength(5)
  })

  it("invalidates reviewed data when the provider configuration changes", () => {
    const envelope = minimumFieldMatchContext({
      providerId: "provider_1",
      providerName: "My AI Provider",
      providerBaseUrl: "https://provider.example.test/v1",
      providerModel: "model-a",
      controls: [{ control_id: "email", label: "Email", type: "email" }],
      candidates: [{ information_path: "contact.email", value: "maya@example.test" }],
      neverSendInformationPaths: [],
    })
    expect(() => assertExternalProviderContext(envelope, {
      id: "provider_1",
      providerType: "openai_compatible",
      displayName: "My AI Provider",
      baseUrl: "https://another-provider.example.test/v1",
      model: "model-a",
      rememberKey: false,
      enabled: true,
    })).toThrow("configuration changed")
    expect(() => assertExternalProviderContext(envelope, {
      id: "provider_1",
      providerType: "openai_compatible",
      displayName: "My AI Provider",
      baseUrl: "https://provider.example.test/v2",
      model: "model-a",
      rememberKey: false,
      enabled: true,
    })).toThrow("configuration changed")
  })
})
