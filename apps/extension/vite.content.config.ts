import { resolve } from "node:path"

import { defineConfig } from "vite"

import { extensionOutputDirectory } from "./build-output"
import { distributedDependencyMetadata } from "./vite.distributed-metadata"

export default defineConfig(() => {
  const profile = "personal"
  const outputDirectory = extensionOutputDirectory()
  return {
    define: {
      __REKEYZERO_PROFILE__: JSON.stringify(profile),
    },
    plugins: [distributedDependencyMetadata(profile, "content-script")],
    build: {
      outDir: outputDirectory,
      emptyOutDir: false,
      lib: {
        entry: resolve(import.meta.dirname, "src/content/content-script.ts"),
        formats: ["iife"] as Array<"iife">,
        name: "RekeyZeroContentScript",
        fileName: () => "content-script.js",
      },
    },
  }
})
