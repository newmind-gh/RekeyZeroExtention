import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("Personal release permission model", () => {
  it("keeps website and direct AI provider access optional", () => {
    const manifest = JSON.parse(readFileSync(
      resolve(import.meta.dirname, "../manifest.personal.json"),
      "utf8",
    )) as { permissions?: string[]; host_permissions?: string[]; optional_host_permissions?: string[] }
    expect(manifest.permissions).toContain("tabs")
    expect(manifest).not.toHaveProperty("optional_permissions")
    expect(manifest).not.toHaveProperty("host_permissions")
    expect(manifest.optional_host_permissions).toEqual(expect.arrayContaining([
      "https://*/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ]))
  })
})
