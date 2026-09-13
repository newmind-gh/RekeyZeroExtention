import type { WorkerRequest, WorkerResponse } from "../shared/messages"

export function userFacingWorkerError(message: string): string {
  if (/(?:HTTP\s+503|service unavailable|temporar(?:ily)? unavailable|overload)/i.test(message)) {
    return "AI service is temporarily unavailable or overloaded. Please try again shortly."
  }
  if (/(?:HTTP\s+429|rate[- ]?limit|quota exceeded)/i.test(message)) {
    return "AI service is busy or rate-limited. Please try again shortly."
  }
  if (/(?:HTTP\s+(?:500|502|504)|timed? out|timeout)/i.test(message)) {
    return "AI service is temporarily unavailable. Please try again shortly."
  }
  if (/(?:failed to fetch|network error|network request failed)/i.test(message)) {
    return "Unable to reach the AI service. Check your connection and try again."
  }
  if (/invalid JSON/i.test(message)) {
    return "AI service returned an invalid response. Please try again."
  }
  return message
}

export async function worker<T>(request: WorkerRequest): Promise<T> {
  const response = await chrome.runtime.sendMessage<WorkerRequest, WorkerResponse<T>>(request)
  if (!response?.ok) {
    const detail = response?.error || "RekeyZero could not complete this action"
    throw new Error(userFacingWorkerError(detail))
  }
  return response.data
}
