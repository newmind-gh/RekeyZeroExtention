import { putStored } from "./indexed-db"
import type { PersonalLlmLog } from "./schema"

export async function logPersonalRuntimeError(
  error: unknown,
  requestType: string,
  context: { providerId?: string; modelId?: string; rawRequest?: unknown; rawResponse?: string } = {},
): Promise<void> {
  const caught = error instanceof Error ? error : new Error(String(error))
  await putStored<PersonalLlmLog>("llm_logs", {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    task: "runtime_error",
    target: "Extension runtime",
    providerId: context.providerId ?? "rekeyzero-personal",
    modelId: context.modelId ?? "none",
    status: "error",
    request_type: requestType,
    error: {
      message: caught.message,
      ...(caught.stack ? { stack: caught.stack } : {}),
    },
    exact_matches: [],
    raw_request: context.rawRequest ?? null,
    raw_response: context.rawResponse ?? "",
    parsed_mappings: [],
    rejected_mappings: [],
    final_mappings: [],
  })
}
