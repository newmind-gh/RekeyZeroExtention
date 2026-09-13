import { useEffect } from "react"

import { TransferPanel } from "./TransferPanel"

export function App() {
  useEffect(() => {
    void chrome.runtime.sendMessage({
      type: "TRANSFER",
      command: { type: "SET_TRANSFER_ACTIVE", active: true },
    }).catch(() => undefined)
  }, [])

  return <TransferPanel />
}
