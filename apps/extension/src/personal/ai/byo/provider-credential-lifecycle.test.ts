import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { PersonalAdminService } from "../../core/personal-admin-service"
import { clearPersonalDatabase } from "../../storage/indexed-db"
import { getProviderKey } from "./secret-store"

type StorageValues = Record<string, unknown>

function storageArea(values: StorageValues) {
  return {
    async get(key: string) { return { [key]: values[key] } },
    async set(input: StorageValues) { Object.assign(values, input) },
    async remove(key: string) { delete values[key] },
    async setAccessLevel() {},
  }
}

const sessionValues: StorageValues = {}
const localValues: StorageValues = {}
const removedOrigins: string[] = []

vi.stubGlobal("chrome", {
  storage: {
    session: storageArea(sessionValues),
    local: storageArea(localValues),
  },
  permissions: {
    async remove(input: { origins?: string[] }) {
      removedOrigins.push(...(input.origins ?? []))
      return true
    },
  },
})

const baseSettings = {
  aiMode: "local_then_ask_external" as const,
  localModelEnabled: false,
  neverSendInformationPaths: [],
}

describe("BYO provider credential lifecycle", () => {
  const admin = new PersonalAdminService()

  beforeEach(async () => {
    await clearPersonalDatabase()
    for (const key of Object.keys(sessionValues)) delete sessionValues[key]
    for (const key of Object.keys(localValues)) delete localValues[key]
    removedOrigins.length = 0
  })

  it("clears the old credential and requires a new key when the origin changes", async () => {
    const first = await admin.configureAi({
      ...baseSettings,
      provider: {
        displayName: "Provider A",
        baseUrl: "https://api.provider-a.test/v1",
        model: "model-a",
        rememberKey: true,
        apiKey: "provider-a-secret",
      },
    })
    const providerId = first.provider!.id

    await expect(admin.configureAi({
      ...baseSettings,
      provider: {
        displayName: "Provider B",
        baseUrl: "https://api.provider-b.test/v1",
        model: "model-b",
        rememberKey: true,
      },
    })).rejects.toThrow("new API key")
    expect(await getProviderKey(providerId, "https://api.provider-a.test/v1")).toBeNull()
    expect(removedOrigins).toHaveLength(0)

    await admin.configureAi({
      ...baseSettings,
      provider: {
        displayName: "Provider B",
        baseUrl: "https://api.provider-b.test/v1",
        model: "model-b",
        rememberKey: true,
        apiKey: "provider-b-secret",
      },
    })
    expect(await getProviderKey(providerId, "https://api.provider-b.test/v1")).toBe("provider-b-secret")
    expect(removedOrigins).toContain("https://api.provider-a.test/*")
  })

  it("rejects and removes an unbound legacy credential", async () => {
    sessionValues["personalProviderKey:legacy"] = "legacy-raw-secret"
    localValues["personalRememberedProviderKey:legacy"] = "legacy-raw-secret"
    expect(await getProviderKey("legacy", "https://api.provider.test/v1")).toBeNull()
    expect(Object.keys(sessionValues)).toHaveLength(0)
    expect(Object.keys(localValues)).toHaveLength(0)
  })

  it("removes persistence while retaining the same-origin session key", async () => {
    const configured = await admin.configureAi({
      ...baseSettings,
      provider: {
        displayName: "Provider",
        baseUrl: "https://api.provider.test/v1",
        model: "model-a",
        rememberKey: true,
        apiKey: "session-secret",
      },
    })
    await admin.configureAi({
      ...baseSettings,
      provider: {
        displayName: "Provider",
        baseUrl: "https://api.provider.test/v2",
        model: "model-b",
        rememberKey: false,
      },
    })

    expect(await getProviderKey(configured.provider!.id, "https://api.provider.test/v2")).toBe("session-secret")
    expect(Object.keys(localValues)).toHaveLength(0)
  })

  it("persists an existing same-origin session key when remember is enabled", async () => {
    const configured = await admin.configureAi({
      ...baseSettings,
      provider: {
        displayName: "Provider",
        baseUrl: "https://api.provider.test/v1",
        model: "model-a",
        rememberKey: false,
        apiKey: "session-secret",
      },
    })
    expect(Object.keys(localValues)).toHaveLength(0)

    await admin.configureAi({
      ...baseSettings,
      provider: {
        displayName: "Provider",
        baseUrl: "https://api.provider.test/v1",
        model: "model-a",
        rememberKey: true,
      },
    })
    expect(await getProviderKey(configured.provider!.id, "https://api.provider.test/v1")).toBe("session-secret")
    expect(Object.keys(localValues)).toHaveLength(1)
  })

  it("removes the provider host permission when the provider is removed", async () => {
    await admin.configureAi({
      ...baseSettings,
      provider: {
        displayName: "Provider",
        baseUrl: "https://api.provider.test/v1",
        model: "model-a",
        rememberKey: false,
        apiKey: "session-secret",
      },
    })

    await admin.removeProvider()

    expect(removedOrigins).toContain("https://api.provider.test/*")
  })
})
