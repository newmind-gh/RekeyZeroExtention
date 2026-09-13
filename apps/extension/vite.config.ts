import { copyFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { extensionOutputDirectory } from "./build-output"
import { distributedDependencyMetadata } from "./vite.distributed-metadata"

export default defineConfig(() => {
  const profile = "personal"
  const outputDirectory = extensionOutputDirectory()
  const localAiFamily = process.env.REKEYZERO_LOCAL_AI_FAMILY || "local"
  const webLlmRuntimeEntry = process.env.REKEYZERO_WEBLLM_RUNTIME_ENTRY
  return {
    define: {
      __REKEYZERO_PROFILE__: JSON.stringify(profile),
      __REKEYZERO_LOCAL_AI_FAMILY__: JSON.stringify(localAiFamily),
    },
    resolve: {
      alias: {
        "@rekeyzero/active-runtime": resolve(import.meta.dirname, "src/runtime/active-runtime.personal.ts"),
        ...(webLlmRuntimeEntry ? { "@mlc-ai/web-llm": webLlmRuntimeEntry } : {}),
      },
    },
    ssr: {
      noExternal: ["@mlc-ai/web-llm"],
    },
    plugins: [
      react(),
      distributedDependencyMetadata(profile, "application"),
      {
        name: "copy-extension-manifest",
        closeBundle() {
          mkdirSync(outputDirectory, { recursive: true })
          copyFileSync(
            resolve(import.meta.dirname, `manifest.${profile}.json`),
            resolve(outputDirectory, "manifest.json"),
          )
        },
      },
    ],
    build: {
      outDir: outputDirectory,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          sidepanel: resolve(import.meta.dirname, "sidepanel.html"),
          "service-worker": resolve(import.meta.dirname, "src/background/service-worker.ts"),
          rekeyzero: resolve(import.meta.dirname, "rekeyzero.html"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  }
})
