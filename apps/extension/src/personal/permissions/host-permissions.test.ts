import { describe, expect, it, vi } from "vitest"

import { removeHostPermissionIfUnused } from "./host-permissions"

describe("Personal optional host permissions", () => {
  it("removes an origin when no provider or Mapping Profile still needs it", async () => {
    const remove = vi.fn(async () => true)
    vi.stubGlobal("chrome", { permissions: { remove } })

    expect(await removeHostPermissionIfUnused({
      origin: "https://unused.example.test/v1",
      providers: [],
      profiles: [],
    })).toBe(true)
    expect(remove).toHaveBeenCalledWith({ origins: ["https://unused.example.test/*"] })
  })

  it("retains an enabled provider origin but ignores disabled providers", async () => {
    const remove = vi.fn(async () => true)
    vi.stubGlobal("chrome", { permissions: { remove } })
    const provider = {
      id: "provider",
      providerType: "openai_compatible" as const,
      displayName: "Provider",
      baseUrl: "https://shared.example.test/v1",
      model: "model",
      rememberKey: false,
      enabled: true,
    }
    expect(await removeHostPermissionIfUnused({
      origin: "https://shared.example.test",
      providers: [provider],
      profiles: [],
    })).toBe(false)
    expect(remove).not.toHaveBeenCalled()

    expect(await removeHostPermissionIfUnused({
      origin: "https://shared.example.test",
      providers: [{ ...provider, enabled: false }],
      profiles: [],
    })).toBe(true)
    expect(remove).toHaveBeenCalledWith({ origins: ["https://shared.example.test/*"] })
  })

  it("retains profile origins and removes an origin after its last profile is deleted", async () => {
    const remove = vi.fn(async () => true)
    vi.stubGlobal("chrome", { permissions: { remove } })
    const profile = {
      id: "profile",
      name: "Profile",
      version: 1 as const,
      source: { origin: "https://source.example.test", pathPattern: "/:segment", template: "source", title: "Source" },
      targets: [{ id: "target", origin: "https://target.example.test", pathPattern: "/:segment", template: "target", title: "Target", mappings: [] }],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    }

    expect(await removeHostPermissionIfUnused({
      origin: "https://target.example.test/form",
      providers: [],
      profiles: [profile],
    })).toBe(false)
    expect(remove).not.toHaveBeenCalled()

    expect(await removeHostPermissionIfUnused({
      origin: "https://target.example.test/form",
      providers: [],
      profiles: [],
    })).toBe(true)
    expect(remove).toHaveBeenCalledWith({ origins: ["https://target.example.test/*"] })
  })
})
