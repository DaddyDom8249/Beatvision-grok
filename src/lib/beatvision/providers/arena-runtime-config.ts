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
