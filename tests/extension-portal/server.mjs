export * from "./server-core.mjs"
import { startPortalServer } from "./server-core.mjs"

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`).href) {
  const portal = await startPortalServer(Number(process.env.PORT ?? 4178))
  process.stdout.write(`RekeyZero extension test portal: ${portal.baseUrl}\n`)
}
