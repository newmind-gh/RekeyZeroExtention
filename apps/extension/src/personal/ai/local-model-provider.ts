import {
  CreateMLCEngine,
  deleteModelAllInfoInCache,
  hasModelInCache,
} from "@mlc-ai/web-llm"
import type { MLCEngine } from "@mlc-ai/web-llm"

import { localModel } from "./model-registry"
import { extractJson } from "./model-provider"
import type {
  ModelHealth,
  ModelRequest,
  ModelResult,
  PersonalModelProvider,
} from "./model-provider"

export type LocalModelStatus = ModelHealth & {
  modelId: string
  progress?: number
}

type LocalChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type FieldMatchContract = {
  targets: string[]
  sources: Array<string | null>
}

type CanonicalFieldMatchDecision = {
  target: string
  source: string | null
}

type CanonicalFieldMatchOutput = {
  decisions: CanonicalFieldMatchDecision[]
}

let engine: MLCEngine | null = null
let loadedModelId: string | null = null
let loading: Promise<MLCEngine> | null = null
let loadingModelId: string | null = null
let progress = 0
let operationTail: Promise<void> = Promise.resolve()

async function runExclusive<T>(operation: () => Promise<T>): Promise<T> {
  const previous = operationTail
  let release!: () => void
  operationTail = new Promise<void>((resolve) => { release = resolve })
  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

function isModelNotLoadedError(error: unknown): boolean {
  return error instanceof Error
    && error.message.includes("Model not loaded before trying to complete")
}

function isFatalLocalEngineError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return [
    "device was lost",
    "dxgi_error_device_removed",
    "failed to execute 'requestdevice' on 'gpuadapter'",
    "cannot pass deleted object",
    "object has already been disposed",
  ].some((text) => message.includes(text))
}

function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function enumValues(value: unknown): Array<string | null> {
  const definition = asRecord(value)
  if (!definition || !Array.isArray(definition.enum)) return []
  return definition.enum.filter((candidate): candidate is string | null => candidate === null || typeof candidate === "string")
}

function fieldMatchContract(request: ModelRequest): FieldMatchContract | null {
  if (request.task !== "field_match" || !request.schema) return null
  const rootProperties = asRecord(request.schema.properties)
  const decisions = asRecord(rootProperties?.decisions)
  const items = asRecord(decisions?.items)
  const itemProperties = asRecord(items?.properties)
  const targets = enumValues(itemProperties?.target).filter((value): value is string => typeof value === "string")
  const sources = enumValues(itemProperties?.source)
  return targets.length > 0 && sources.length > 0 ? { targets, sources } : null
}

function canonicalDecision(
  value: unknown,
  allowedTargets: Set<string>,
  allowedSources: Set<string | null>,
): CanonicalFieldMatchDecision | null {
  const decision = asRecord(value)
  if (!decision) return null

  const target = decision.target ?? decision.target_field
  const source = Object.prototype.hasOwnProperty.call(decision, "source")
    ? decision.source
    : Object.prototype.hasOwnProperty.call(decision, "source_field")
      ? decision.source_field
      : null

  if (typeof target !== "string" || !allowedTargets.has(target)) return null
  if (source !== null && typeof source !== "string") return null
  if (!allowedSources.has(source as string | null)) return null
  return { target, source: source as string | null }
}

function decisionsFromExactMap(
  value: unknown,
  allowedTargets: Set<string>,
  allowedSources: Set<string | null>,
): CanonicalFieldMatchDecision[] | null {
  const map = asRecord(value)
  if (!map) return null
  const entries = Object.entries(map)
  if (!entries.length || entries.some(([target]) => !allowedTargets.has(target))) return null
  const decisions: CanonicalFieldMatchDecision[] = []
  for (const [target, source] of entries) {
    if (source !== null && typeof source !== "string") return null
    if (!allowedSources.has(source as string | null)) return null
    decisions.push({ target, source: source as string | null })
  }
  return decisions
}

function canonicalizeFieldMatchOutput(
  contract: FieldMatchContract,
  output: unknown,
): CanonicalFieldMatchOutput | null {
  const allowedTargets = new Set(contract.targets)
  const allowedSources = new Set<string | null>(contract.sources)
  const root = asRecord(output)

  let rawDecisions: unknown[] | null = null
  if (Array.isArray(output)) {
    rawDecisions = output
  } else if (root) {
    if (Array.isArray(root.decisions)) rawDecisions = root.decisions
    else if (root.decisions !== undefined) {
      const one = canonicalDecision(root.decisions, allowedTargets, allowedSources)
      if (one) rawDecisions = [root.decisions]
      else {
        const mapped = decisionsFromExactMap(root.decisions, allowedTargets, allowedSources)
        if (mapped) rawDecisions = mapped
      }
    }

    if (!rawDecisions && Array.isArray(root.matches)) rawDecisions = root.matches
    if (!rawDecisions && Array.isArray(root.mappings)) rawDecisions = root.mappings
    if (!rawDecisions && canonicalDecision(root, allowedTargets, allowedSources)) rawDecisions = [root]
    if (!rawDecisions) {
      const mapped = decisionsFromExactMap(root, allowedTargets, allowedSources)
      if (mapped) rawDecisions = mapped
    }
  }
  if (!rawDecisions) return null

  const byTarget = new Map<string, string | null>()
  for (const value of rawDecisions) {
    const alreadyCanonical = asRecord(value)
      && typeof asRecord(value)?.target === "string"
      && Object.prototype.hasOwnProperty.call(asRecord(value)!, "source")
    const decision = alreadyCanonical
      ? canonicalDecision(value, allowedTargets, allowedSources)
      : canonicalDecision(value, allowedTargets, allowedSources)
    if (!decision || byTarget.has(decision.target)) return null
    byTarget.set(decision.target, decision.source)
  }

  // Missing targets are a safe format repair: null means "no semantic match" and never
  // invents a source. Unknown targets/sources and duplicates are rejected above.
  return {
    decisions: contract.targets.map((target) => ({
      target,
      source: byTarget.get(target) ?? null,
    })),
  }
}

function parseWebLlmOutput<T>(request: ModelRequest, content: string): T {
  const output = extractJson<unknown>(content)
  const contract = fieldMatchContract(request)
  if (!contract) return output as T

  const canonical = canonicalizeFieldMatchOutput(contract, output)
  if (!canonical) {
    throw new Error("Local AI returned JSON that cannot be safely normalized to the required field-match contract")
  }
  return canonical as T
}

function webLlmSystemPrompt(request: ModelRequest): string {
  const contract = fieldMatchContract(request)
  if (!contract) return request.system

  const targetList = contract.targets.map((target) => `- ${JSON.stringify(target)}`).join("\n")
  const sourceList = contract.sources.map((source) => `- ${source === null ? "null" : JSON.stringify(source)}`).join("\n")
  return `${request.system}\n\nWEBLLM OUTPUT CONTRACT — follow literally:\nReturn exactly one JSON object with this shape: {"decisions":[{"target":"<exact target identity>","source":"<exact source identity or null>"}]}\nUse only the keys "decisions", "target", and "source". Never rename them to target_field/source_field or use nested maps.\nInclude every target below exactly once. Copy each complete target identity character-for-character, including section text. Do not shorten it.\nChoose source only from the allowed source identities below, or use null.\nDo not wrap the JSON object in an array. Do not use markdown fences. Do not add explanation or commentary.\n\nExact target identities:\n${targetList}\n\nAllowed source identities:\n${sourceList}`
}

export class LocalModelProvider implements PersonalModelProvider {
  readonly id = "personal-local-lite"
  readonly kind = "browser_local" as const

  constructor(readonly modelId: string) {}

  async health(): Promise<LocalModelStatus> {
    const definition = localModel(this.modelId)
    if (!webgpuAvailable()) {
      return { status: "unsupported_device", modelId: this.modelId, detail: "WebGPU unavailable" }
    }
    if (engine && loadedModelId === this.modelId) return { status: "ready", modelId: this.modelId }
    if (loading && loadingModelId === this.modelId) {
      return { status: "loading", modelId: this.modelId, progress }
    }
    if (!definition.runtimeAvailable) {
      return { status: "failed", modelId: this.modelId, detail: definition.unavailableReason }
    }
    const cached = await hasModelInCache(definition.modelArtifact)
    return {
      status: cached ? "ready" : "not_ready",
      modelId: this.modelId,
      detail: cached ? "Downloaded; loads when needed" : "Not downloaded",
    }
  }

  async load(): Promise<void> {
    localModel(this.modelId)
    await runExclusive(async () => { await this.engine() })
  }

  async delete(): Promise<void> {
    const definition = localModel(this.modelId)
    await runExclusive(async () => {
      if (engine && loadedModelId === this.modelId) {
        await engine.unload()
        engine = null
        loadedModelId = null
      }
      if (definition.runtimeAvailable) {
        await deleteModelAllInfoInCache(definition.modelArtifact)
      }
    })
  }

  async completeJson<T>(request: ModelRequest, signal?: AbortSignal): Promise<ModelResult<T>> {
    localModel(this.modelId)
    return runExclusive(async () => {
      let failedEngine: MLCEngine | null = null
      try {
        if (signal?.aborted) throw new DOMException("Local AI request was cancelled", "AbortError")
        const activeEngine = await this.engine()
        failedEngine = activeEngine
        const baseMessages: LocalChatMessage[] = [
          { role: "system", content: webLlmSystemPrompt(request) },
          {
            role: "user",
            content: typeof request.input === "string" ? request.input : JSON.stringify(request.input),
          },
        ]
        // Do not use WebLLM response_format/schema here. That path enables xgrammar's
        // GrammarMatcher, which can leave a disposed WASM object behind and crash later
        // requests. Field matching receives its compact JSON contract in the system prompt;
        // safe shape deviations are canonicalized locally. Unknown identities and unsafe
        // structures still retry once and then fail closed.
        const options = {
          temperature: 0,
          max_tokens: request.maxTokens ?? 512,
        }
        const complete = async (messages: LocalChatMessage[]) => {
          try {
            return await activeEngine.chat.completions.create({ messages, ...options })
          } catch (error) {
            if (!isModelNotLoadedError(error)) throw error
            await this.reload(activeEngine)
            return activeEngine.chat.completions.create({ messages, ...options })
          }
        }
        const response = await complete(baseMessages)
        let content = response.choices[0]?.message.content
        if (!content) throw new Error("Local AI returned no result")
        const rawResponses = [content]
        let output: T
        try {
          output = parseWebLlmOutput<T>(request, content)
        } catch {
          if (signal?.aborted) throw new DOMException("Local AI request was cancelled", "AbortError")
          const retry = await complete([
            ...baseMessages,
            { role: "assistant", content },
            { role: "user", content: "The previous response was invalid JSON or could not be safely normalized to the required field-match contract. Return one compact JSON object with a decisions array. Use only exact target identities and allowed source identities from the prompt. Include every target exactly once. Do not add markdown or commentary." },
          ])
          content = retry.choices[0]?.message.content
          if (!content) throw new Error("Local AI returned no result on retry")
          rawResponses.push(content)
          try { output = parseWebLlmOutput<T>(request, content) }
          catch { throw new Error("Local AI returned an unsafe or invalid field-match format twice. Try creating the Fill Setup again.") }
        }
        return {
          output,
          providerId: this.id,
          modelId: this.modelId,
          rawResponses,
        }
      } catch (error) {
        if (!isFatalLocalEngineError(error)) throw error
        this.invalidate(failedEngine)
        const detail = error instanceof Error ? error.message : "Unknown WebGPU error"
        throw new Error(`Local AI GPU session was lost. The model will be reloaded on the next attempt. Original error: ${detail}`)
      }
    })
  }

  private invalidate(activeEngine: MLCEngine | null): void {
    if (activeEngine && engine !== activeEngine) return
    engine = null
    loadedModelId = null
  }

  private async reload(activeEngine: MLCEngine): Promise<void> {
    const definition = localModel(this.modelId)
    loadedModelId = null
    try {
      await activeEngine.reload(definition.modelArtifact, {
        context_window_size: definition.runtimeContextTokens ?? definition.maxContextTokens,
      })
      engine = activeEngine
      loadedModelId = this.modelId
    } catch (error) {
      if (engine === activeEngine) engine = null
      throw error
    }
  }

  private async engine(): Promise<MLCEngine> {
    if (!webgpuAvailable()) throw new Error("Local AI requires WebGPU")
    if (engine && loadedModelId === this.modelId) return engine
    if (loading && loadingModelId === this.modelId) return loading
    const definition = localModel(this.modelId)
    if (definition.runtime !== "webllm") throw new Error("This Local AI model does not use WebLLM")
    if (!definition.runtimeAvailable) {
      throw new Error(definition.unavailableReason ?? "This Local AI model is unavailable")
    }
    if (engine) {
      await engine.unload()
      engine = null
      loadedModelId = null
    }
    loadingModelId = this.modelId
    loading = CreateMLCEngine(
      definition.modelArtifact,
      {
        initProgressCallback: (report) => {
          progress = Math.max(0, Math.min(1, report.progress))
        },
      },
      { context_window_size: definition.runtimeContextTokens ?? definition.maxContextTokens },
    )
    try {
      engine = await loading
      loadedModelId = this.modelId
      return engine
    } finally {
      loading = null
      loadingModelId = null
    }
  }
}
