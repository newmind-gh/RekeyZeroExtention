import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"

import { deleteStored, getAllStored } from "./indexed-db"
import { logPersonalRuntimeError } from "./runtime-error-log"
import type { PersonalLlmLog } from "./schema"

let createdId = ""

afterEach(async () => {
  if (createdId) await deleteStored("llm_logs", createdId)
  createdId = ""
})

describe("Personal runtime error log", () => {
  it("stores the original message, stack, request, provider, and model", async () => {
    const error = new ReferenceError("document is not defined")

    await logPersonalRuntimeError(error, "PERSONAL_AI_MATCH_TRANSFER", {
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
    })

    const logs = await getAllStored<PersonalLlmLog>("llm_logs")
    const log = logs.find((candidate) => candidate.error?.message === error.message)
    expect(log).toMatchObject({
      task: "runtime_error",
      status: "error",
      request_type: "PERSONAL_AI_MATCH_TRANSFER",
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
      error: { message: "document is not defined" },
    })
    expect(log?.error?.stack).toContain("ReferenceError: document is not defined")
    createdId = log?.id ?? ""
  })
})
