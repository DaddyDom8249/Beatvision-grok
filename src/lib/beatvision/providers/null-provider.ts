/**
 * Default provider when no real backend is wired.
 * Always returns explicit unavailable — never fake media.
 */

import type {
  GenerationRequest,
  ProviderAvailability,
  ProviderResult,
  SceneMediaProvider,
} from "./types.ts";

export const nullProvider: SceneMediaProvider = {
  id: "none",
  capabilities: [],
  availability(): ProviderAvailability {
    return {
      available: false,
      provider: "none",
      code: "not_configured",
      reason:
        "No media generation provider is configured. Scene generation is unavailable until a real provider is connected.",
    };
  },
  async generate(_request: GenerationRequest): Promise<ProviderResult> {
    return {
      ok: false,
      provider: "none",
      code: "not_configured",
      message:
        "No media generation provider is configured. BeatVision will not invent or placeholder media.",
    };
  },
};
