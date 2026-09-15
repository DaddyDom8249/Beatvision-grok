/** Canonical server-side Arena runtime configuration. */
export const ARENA_WORKER_URL =
  typeof process !== "undefined" ? process.env?.ARENA_WORKER_URL?.trim() ?? "" : "";

export const GATEWAY_TOKEN =
  typeof process !== "undefined" ? process.env?.GATEWAY_TOKEN?.trim() ?? "" : "";

export function arenaRuntimeConfigStatus() {
  return {
    arenaUrlConfigured: Boolean(ARENA_WORKER_URL),
    gatewayTokenConfigured: Boolean(GATEWAY_TOKEN),
  };
}

export function arenaAuthHeaders(requestId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-BeatVision-Contract": "1.1",
  };
  if (GATEWAY_TOKEN) {
    headers.Authorization = `Bearer ${GATEWAY_TOKEN}`;
  }
  if (requestId) headers["X-BeatVision-Request"] = requestId;
  return headers;
}
