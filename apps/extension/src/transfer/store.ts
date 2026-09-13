import { deleteStored, getAllStored, putStored } from "../personal/storage/indexed-db"
import type { MappingProfile, Session } from "./types"

export const SESSION_KEY = "rekeyzeroTransfer"
export const PROFILE_REVISION_KEY = "rekeyzeroProfilesRevision"
export async function loadSession(): Promise<Session | undefined> {
  await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  const saved = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] as Session | undefined
  if (!saved) return undefined
  const fields = [
    ...(saved.source?.fields ?? []),
    ...saved.targets.flatMap((target) => target.observation?.fields ?? []),
    ...saved.targets.flatMap((target) => target.plan?.actions.map((action) => action.field) ?? []),
  ]
  // Pre-instance-key checkpoints cannot safely distinguish repeated records. Discard
  // the browser-session batch instead of attempting an ambiguous migration.
  if (fields.some((field) => !field.templateKey || !field.instanceKey)) {
    await chrome.storage.session.remove(SESSION_KEY)
    return undefined
  }
  return saved
}
export async function saveSession(session: Session): Promise<void> {
  if (new TextEncoder().encode(JSON.stringify(session)).byteLength > 7_000_000) throw new Error("Batch exceeds session capacity. Remove targets or select a smaller source group.")
  await chrome.storage.session.set({ [SESSION_KEY]: session })
}
export const profiles = () => getAllStored<MappingProfile>("transfer_mapping_profiles")
export const putProfile = (profile: MappingProfile) => putStored("transfer_mapping_profiles", profile)
export const deleteProfile = (id: string) => deleteStored("transfer_mapping_profiles", id)
export const notifyProfilesChanged = () => chrome.storage.local.set({
  [PROFILE_REVISION_KEY]: crypto.randomUUID(),
})
export function pagePathPattern(raw: string): string {
  const url = new URL(raw)
  const segments = url.pathname.split("/").filter(Boolean)
  return segments.length ? `/${segments.map(() => ":segment").join("/")}` : "/"
}
