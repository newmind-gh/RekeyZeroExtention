import "fake-indexeddb/auto"

import { beforeEach, describe, expect, it } from "vitest"

import { clearPersonalDatabase, getAllStored } from "../storage/indexed-db"
import type { PersonalEvidence } from "../storage/schema"
import { PersonalRecordService } from "./record-service"

describe("Personal Information Revisions", () => {
  const records = new PersonalRecordService()

  beforeEach(async () => clearPersonalDatabase())

  it("keeps a validated revision immutable while imported facts await review", async () => {
    const validated = await records.saveValidated({ contact: { email: "old@example.test" } })
    const pending = await records.createPending({ contact: { email: "new@example.test" } }, "import")

    expect((await records.getCurrentRevision())?.id).toBe(validated.id)
    expect((await records.getCurrentRevision())?.information).toEqual({ contact: { email: "old@example.test" } })
    expect((await records.getPendingRevision())?.id).toBe(pending.id)

    await records.validatePending(pending.id)
    expect((await records.getCurrentRevision())?.information).toEqual({ contact: { email: "new@example.test" } })
  })

  it("protects the current validated revision from deletion", async () => {
    const current = await records.saveValidated({ name: "Ada" })
    await expect(records.deleteRevision(current.id)).rejects.toThrow("cannot be deleted")
  })

  it("deletes revision evidence with a deleted non-current revision", async () => {
    await records.saveValidated({ name: "Current" })
    const pending = await records.createPending(
      { name: "Imported" },
      "import",
      [{ path: "name", excerpt: "name: Imported" }],
    )
    expect(await getAllStored<PersonalEvidence>("evidence")).toHaveLength(1)
    await records.deleteRevision(pending.id)
    expect(await getAllStored<PersonalEvidence>("evidence")).toHaveLength(0)
  })
})
