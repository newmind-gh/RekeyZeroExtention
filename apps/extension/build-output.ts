import { resolve } from "node:path"

const repositoryRoot = resolve(import.meta.dirname, "../..")

export function extensionOutputDirectory(): string {
  const configuredOutput = process.env.REKEYZERO_EXTENSION_OUTPUT_DIRECTORY
  if (configuredOutput) return resolve(configuredOutput)

  return resolve(repositoryRoot, "dist", "rekeyzero-personal")
}
