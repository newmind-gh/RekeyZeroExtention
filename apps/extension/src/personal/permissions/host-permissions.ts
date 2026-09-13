import type { PersonalProviderConfig } from "../storage/schema"
import type { MappingProfile } from "../../transfer/types"

export function hostPermissionPattern(originOrUrl: string): string {
  return `${new URL(originOrUrl).origin}/*`
}

export async function removeHostPermissionIfUnused(input: {
  origin: string
  providers: PersonalProviderConfig[]
  profiles: MappingProfile[]
}): Promise<boolean> {
  const origin = new URL(input.origin).origin
  const stillUsed = input.providers.some(
    (provider) => provider.enabled && new URL(provider.baseUrl).origin === origin,
  ) || input.profiles.some(
    (profile) => profile.source.origin === origin || profile.targets.some((target) => target.origin === origin),
  )
  if (stillUsed) return false
  return chrome.permissions.remove({ origins: [hostPermissionPattern(origin)] })
}
