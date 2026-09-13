import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  DirectApiProvider,
  builtinApiHealth,
  builtinApiModel,
  builtinApiModelConfig,
  configureBuiltinApiModel,
  removeBuiltinApiModel,
} from "./direct-api-provider"

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

vi.stubGlobal("chrome", {
  storage: {
    session: storageArea(sessionValues),
    local: storageArea(localValues),
  },
})

const request = {
  task: "field_match" as const,
  system: "Match fields",
  input: "Source and target fields",
  schema: { type: "object" },
  maxTokens: 512,
}

describe("direct Gemini and DeepSeek providers", () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal("chrome", {
      storage: {
        session: storageArea(sessionValues),
        local: storageArea(localValues),
      },
    })
    for (const key of Object.keys(sessionValues)) delete sessionValues[key]
    for (const key of Object.keys(localValues)) delete localValues[key]
  })

  it("requires the user to enter a key in the extension UI", async () => {
    await expect(builtinApiHealth("personal-gemini-api-v1")).resolves.toMatchObject({
      status: "not_ready",
      detail: expect.stringContaining("extension UI"),
    })
  })

  it("calls Gemini directly without putting the key in the URL or request body", async () => {
    await configureBuiltinApiModel({
      modelId: "personal-gemini-api-v1",
      model: "gemini-test-model",
      rememberKey: false,
      apiKey: "gemini-user-secret",
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "{\"decisions\":[]}" }] } }],
    }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const definition = builtinApiModel("personal-gemini-api-v1")
    const config = await builtinApiModelConfig(definition.id)
    const result = await new DirectApiProvider(definition, config.model).completeJson(request)

    expect(result).toMatchObject({ output: { decisions: [] }, modelId: "gemini-test-model" })
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent")
    expect(url).not.toContain("gemini-user-secret")
    expect(options.headers).toMatchObject({ "x-goog-api-key": "gemini-user-secret" })
    expect(String(options.body)).not.toContain("gemini-user-secret")
  })

  it("calls DeepSeek directly with the user-selected model", async () => {
    await configureBuiltinApiModel({
      modelId: "personal-deepseek-api-v1",
      model: "deepseek-test-model",
      rememberKey: true,
      apiKey: "deepseek-user-secret",
    })
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "{\"decisions\":[]}" }, finish_reason: "stop" }],
    }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const definition = builtinApiModel("personal-deepseek-api-v1")
    const config = await builtinApiModelConfig(definition.id)
    const result = await new DirectApiProvider(definition, config.model).completeJson(request)

    expect(result).toMatchObject({ output: { decisions: [] }, modelId: "deepseek-test-model" })
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.deepseek.com/chat/completions")
    expect(options.headers).toMatchObject({ Authorization: "Bearer deepseek-user-secret" })
    expect(JSON.parse(String(options.body))).toMatchObject({ model: "deepseek-test-model" })
  })

  it("removes the configured model and credential", async () => {
    await configureBuiltinApiModel({
      modelId: "personal-deepseek-api-v1",
      model: "deepseek-test-model",
      rememberKey: true,
      apiKey: "deepseek-user-secret",
    })

    await removeBuiltinApiModel("personal-deepseek-api-v1")

    await expect(builtinApiModelConfig("personal-deepseek-api-v1")).resolves.toMatchObject({
      configured: false,
      hasKey: false,
    })
  })
})
