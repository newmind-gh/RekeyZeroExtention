import type { ContentRequest, ContentResponse } from "../shared/messages"
import { handleTransferPage } from "../transfer/page"
import type { PageCommand } from "../transfer/types"

chrome.runtime.onMessage.addListener(
  (request: ContentRequest | PageCommand, _sender, sendResponse) => {
    if (request.type === "TRANSFER_PAGE") {
      void handleTransferPage(request).then(sendResponse)
      return true
    }
    sendResponse(request.type === "PING"
      ? { ok: true } satisfies ContentResponse
      : { ok: false, error: "Unsupported RekeyZero content command" } satisfies ContentResponse)
    return false
  },
)
