import { describe, expect, it } from "vitest"

import {
  dependencyInventory,
  detectSecrets,
  mergeDistributedDependencyInventories,
} from "./release-support.mjs"

describe("release evidence helpers", () => {
  it("preserves scoped names and inventories nested package versions", () => {
    const inventory = dependencyInventory({
      packages: {
        "": { dependencies: { "@scope/direct": "1.0.0" } },
        "node_modules/@scope/direct": { version: "1.0.0", license: "MIT" },
        "node_modules/parent/node_modules/@scope/nested": { version: "2.0.0", license: "Apache-2.0" },
      },
    })
    expect(inventory).toEqual([
      {
        package_path: "node_modules/@scope/direct",
        package_name: "@scope/direct",
        version: "1.0.0",
        license: "MIT",
        relationship: "direct",
      },
      {
        package_path: "node_modules/parent/node_modules/@scope/nested",
        package_name: "@scope/nested",
        version: "2.0.0",
        license: "Apache-2.0",
        relationship: "transitive",
      },
    ])
  })

  it("detects common provider, repository, cloud, chat, registry, JWT and key secrets", () => {
    const samples = [
      `sk-${"a".repeat(24)}`,
      `github_pat_${"b".repeat(24)}`,
      `AKIA${"C".repeat(16)}`,
      `xoxb-${"d".repeat(24)}`,
      `npm_${"e".repeat(32)}`,
      `eyJ${"f".repeat(12)}.${"g".repeat(12)}.${"h".repeat(12)}`,
      "-----BEGIN PRIVATE KEY-----",
    ].join("\n")
    expect(new Set(detectSecrets(samples).map(({ id }) => id))).toEqual(new Set([
      "openai_key",
      "github_token",
      "aws_access_key",
      "slack_token",
      "npm_token",
      "jwt",
      "private_key",
    ]))
  })

  it("merges distributed modules without mixing package versions", () => {
    expect(mergeDistributedDependencyInventories([
      [{
        package_name: "react",
        version: "19.1.1",
        license: "MIT",
        module_count: 2,
        bundled_files: ["sidepanel.js"],
      }],
      [{
        package_name: "react",
        version: "19.1.1",
        license: "MIT",
        module_count: 1,
        bundled_files: ["content-script.js", "sidepanel.js"],
      }],
    ])).toEqual([{
      package_name: "react",
      version: "19.1.1",
      license: "MIT",
      module_count: 3,
      bundled_files: ["content-script.js", "sidepanel.js"],
    }])
  })
})
