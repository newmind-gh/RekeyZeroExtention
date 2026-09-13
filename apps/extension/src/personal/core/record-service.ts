import { deleteStored, getAllStored, getStored, putStored } from "../storage/indexed-db"
import type {
  PersonalEvidence,
  PersonalInformationRecord,
  PersonalInformationRevision,
  RevisionSource,
} from "../storage/schema"

export const PERSONAL_RECORD_ID = "personal_record"

function now(): string {
  return new Date().toISOString()
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`
}

export function flattenInformation(
  value: unknown,
  prefix = "",
): Record<string, string | number | boolean | null> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).reduce(
      (result, [key, nested]) => Object.assign(
        result,
        flattenInformation(nested, prefix ? `${prefix}.${key}` : key),
      ),
      {} as Record<string, string | number | boolean | null>,
    )
  }
  if (Array.isArray(value)) return { [prefix]: value.join(", ") }
  return prefix ? { [prefix]: value as string | number | boolean | null } : {}
}

export function setInformationPath(
  information: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const result = structuredClone(information)
  const parts = path.split(".").filter(Boolean)
  if (!parts.length || parts.some((part) => ["__proto__", "prototype", "constructor"].includes(part))) {
    throw new Error("Information path is invalid")
  }
  let current = result
  for (const part of parts.slice(0, -1)) {
    const nested = current[part]
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) current[part] = {}
    current = current[part] as Record<string, unknown>
  }
  current[parts.at(-1) as string] = value
  return result
}

export function deleteInformationPath(
  information: Record<string, unknown>,
  path: string,
): Record<string, unknown> {
  const result = structuredClone(information)
  const parts = path.split(".").filter(Boolean)
  let current: Record<string, unknown> = result
  for (const part of parts.slice(0, -1)) {
    const nested = current[part]
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) return result
    current = nested as Record<string, unknown>
  }
  delete current[parts.at(-1) as string]
  return result
}

export class PersonalRecordService {
  async ensureRecord(): Promise<PersonalInformationRecord> {
    const existing = await getStored<PersonalInformationRecord>("records", PERSONAL_RECORD_ID)
    if (existing) return existing
    const timestamp = now()
    return putStored("records", {
      id: PERSONAL_RECORD_ID,
      name: "Information to Reuse",
      current_validated_revision_id: null,
      created_at: timestamp,
      updated_at: timestamp,
    } satisfies PersonalInformationRecord)
  }

  async getCurrentRevision(): Promise<PersonalInformationRevision | null> {
    const record = await this.ensureRecord()
    return record.current_validated_revision_id
      ? (await getStored<PersonalInformationRevision>(
          "revisions",
          record.current_validated_revision_id,
        )) ?? null
      : null
  }

  async getPendingRevision(): Promise<PersonalInformationRevision | null> {
    const revisions = await this.listRevisions()
    return revisions.find((revision) => revision.status === "pending_review") ?? null
  }

  async listRevisions(): Promise<PersonalInformationRevision[]> {
    return (await getAllStored<PersonalInformationRevision>("revisions"))
      .filter((revision) => revision.record_id === PERSONAL_RECORD_ID)
      .sort((left, right) => right.version - left.version)
  }

  async saveValidated(
    information: Record<string, unknown>,
    source: RevisionSource = "human",
  ): Promise<PersonalInformationRevision> {
    return this.createRevision(information, source, "validated")
  }

  async createPending(
    information: Record<string, unknown>,
    source: RevisionSource,
    evidence: Array<{ path: string; excerpt: string }> = [],
  ): Promise<PersonalInformationRevision> {
    const existingPending = await this.getPendingRevision()
    if (existingPending) {
      existingPending.status = "draft"
      await putStored("revisions", existingPending)
    }
    const revision = await this.createRevision(information, source, "pending_review")
    await Promise.all(evidence.map(({ path, excerpt }) => putStored("evidence", {
      id: id("pev"),
      revision_id: revision.id,
      information_path: path,
      method: source,
      excerpt: excerpt.slice(0, 500),
      created_at: now(),
    } satisfies PersonalEvidence)))
    return revision
  }

  async validatePending(
    revisionId: string,
    reviewedInformation?: Record<string, unknown>,
  ): Promise<PersonalInformationRevision> {
    const revision = await getStored<PersonalInformationRevision>("revisions", revisionId)
    if (!revision || revision.status !== "pending_review") {
      throw new Error("Pending Information Revision was not found")
    }
    if (reviewedInformation) revision.information = structuredClone(reviewedInformation)
    revision.status = "validated"
    revision.validated_at = now()
    await putStored("revisions", revision)
    const record = await this.ensureRecord()
    record.current_validated_revision_id = revision.id
    record.updated_at = now()
    await putStored("records", record)
    return revision
  }

  async deleteFact(path: string): Promise<PersonalInformationRevision> {
    const revision = await this.getCurrentRevision()
    if (!revision) throw new Error("Save Information to Reuse before deleting a fact")
    return this.saveValidated(deleteInformationPath(revision.information, path))
  }

  async deleteRevision(revisionId: string): Promise<void> {
    const record = await this.ensureRecord()
    if (record.current_validated_revision_id === revisionId) {
      throw new Error("The current Validated Information Revision cannot be deleted")
    }
    const evidence = await getAllStored<PersonalEvidence>("evidence")
    await Promise.all([
      deleteStored("revisions", revisionId),
      ...evidence
        .filter((item) => item.revision_id === revisionId)
        .map((item) => deleteStored("evidence", item.id)),
    ])
  }

  private async createRevision(
    information: Record<string, unknown>,
    source: RevisionSource,
    status: "pending_review" | "validated",
  ): Promise<PersonalInformationRevision> {
    const record = await this.ensureRecord()
    const revisions = await this.listRevisions()
    const timestamp = now()
    const revision: PersonalInformationRevision = {
      id: id("prev"),
      record_id: record.id,
      version: (revisions[0]?.version ?? 0) + 1,
      status,
      information: structuredClone(information),
      created_from: source,
      created_at: timestamp,
      ...(status === "validated" ? { validated_at: timestamp } : {}),
    }
    await putStored("revisions", revision)
    if (status === "validated") {
      record.current_validated_revision_id = revision.id
      record.updated_at = timestamp
      await putStored("records", record)
    }
    return revision
  }
}
