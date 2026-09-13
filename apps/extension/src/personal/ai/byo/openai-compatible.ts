import type { PersonalProviderConfig } from "../../storage/schema"
import { extractJson } from "../model-provider"
import type {
  ModelHealth,
  ModelRequest,
  ModelResult,
  PersonalModelProvider,
} from "../model-provider"
import { canonicalProviderBaseUrl, getProviderKey } from "./secret-store"

function providerUrl(config: PersonalProviderConfig): URL {
  const base = new URL(canonicalProviderBaseUrl(config.baseUrl))
  const local = ["localhost", "127.0.0.1"].includes(base.hostname)
  if (base.protocol !== "https:" && !(local && base.protocol === "http:")) {
    throw new Error("External provider endpoints must use HTTPS, except localhost")
  }
  return new URL("chat/completions", `${base.href.replace(/\/+$/, "")}/`)
}

export class OpenAiCompatibleProvider implements PersonalModelProvider {
  readonly kind = "external_api" as const
  readonly id: string

  constructor(readonly config: PersonalProviderConfig) {
    this.id = config.id
  }

  async health(): Promise<ModelHealth> {
    return (await getProviderKey(this.id, this.config.baseUrl))
      ? { status: "ready" }
      : { status: "not_ready", detail: "API key is not available in this browser session" }
  }

  async completeJson<T>(request: ModelRequest, signal?: AbortSignal): Promise<ModelResult<T>> {
    const apiKey = await getProviderKey(this.id, this.config.baseUrl)
    if (!apiKey) throw new Error("Enter the API key for this provider")
    const response = await fetch(providerUrl(this.config), {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: JSON.stringify(request.input) },
        ],
        response_format: { type: "json_object" },
      }),
    })
    if (response.status === 401 || response.status === 403) {
      throw new Error("The provider rejected the API key")
    }
    if (response.status === 429) throw new Error("The provider rate limit was reached")
    if (!response.ok) throw new Error(`The provider returned ${response.status}`)
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) throw new Error("The provider returned no result")
    return {
      output: extractJson<T>(content),
      providerId: this.id,
      modelId: this.config.model,
      rawResponses: [content],
    }
  }
}
