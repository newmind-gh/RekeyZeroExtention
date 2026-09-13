export const SECRET_PATTERNS = [
  { id: "openai_key", pattern: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: "anthropic_key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: "google_api_key", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { id: "github_token", pattern: /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/g },
  { id: "gitlab_token", pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g },
  { id: "aws_access_key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { id: "slack_token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { id: "stripe_live_key", pattern: /\b[rs]k_live_[A-Za-z0-9]{20,}\b/g },
  { id: "sendgrid_key", pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g },
  { id: "npm_token", pattern: /\bnpm_[A-Za-z0-9]{30,}\b/g },
  { id: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { id: "private_key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
]

export function detectSecrets(text) {
  return SECRET_PATTERNS.flatMap(({ id, pattern }) => {
    pattern.lastIndex = 0
    return [...text.matchAll(pattern)].map((match) => ({ id, offset: match.index ?? 0 }))
  })
}

export function dependencyInventory(lock) {
  const root = lock.packages?.[""] ?? {}
  const directNames = new Set([
    ...Object.keys(root.dependencies ?? {}),
    ...Object.keys(root.devDependencies ?? {}),
    ...Object.keys(root.optionalDependencies ?? {}),
  ])
  return Object.entries(lock.packages ?? {})
    .filter(([packagePath]) => packagePath.includes("node_modules/"))
    .map(([packagePath, value]) => {
      const packageName = packagePath.slice(packagePath.lastIndexOf("node_modules/") + 13)
      const topLevelPath = `node_modules/${packageName}`
      return {
        package_path: packagePath,
        package_name: packageName,
        version: value.version ?? "unknown",
        license: value.license ?? "unknown",
        relationship: directNames.has(packageName) && packagePath === topLevelPath
          ? "direct"
          : "transitive",
      }
    })
    .sort((left, right) => left.package_path.localeCompare(right.package_path))
}

export function mergeDistributedDependencyInventories(inventories) {
  const packages = new Map()
  for (const inventory of inventories) {
    for (const item of inventory) {
      const key = `${item.package_name}@${item.version}`
      const existing = packages.get(key) ?? {
        package_name: item.package_name,
        version: item.version,
        license: item.license,
        module_count: 0,
        bundled_files: new Set(),
      }
      existing.module_count += item.module_count
      for (const file of item.bundled_files) existing.bundled_files.add(file)
      packages.set(key, existing)
    }
  }
  return [...packages.values()]
    .map((item) => ({ ...item, bundled_files: [...item.bundled_files].sort() }))
    .sort((left, right) => left.package_name.localeCompare(right.package_name))
}
