/**
 * Provider contracts for BeatVision scene generation.
 * Implementations must never invent media or success.
 */

export type ProviderId = "none" | "xai-image" | "external-video";

export type ProviderCapability = "still_image" | "video_clip" | "motion";

export type ProviderAvailability =
  | { available: true; provider: ProviderId; capabilities: ProviderCapability[] }
  | {
      available: false;
      provider: ProviderId;
      reason: string;
      code:
        | "not_configured"
        | "missing_credentials"
        | "unsupported"
        | "rate_limited"
        | "unreachable";
    };

export type GenerationRequest = {
  projectId: string;
  sceneId: string;
  /** Human-readable scene brief derived from locked world + storyboard */
  brief: string;
  startSec: number;
  endSec: number;
  capability: ProviderCapability;
};

export type ProviderSuccess = {
  ok: true;
  provider: ProviderId;
  kind: "image" | "video" | "audio" | "other";
  /** Durable URL or data reference produced by the provider */
  url: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  meta?: Record<string, unknown>;
};

export type ProviderFailure = {
  ok: false;
  provider: ProviderId;
  code:
    | "not_configured"
    | "missing_credentials"
    | "unsupported"
    | "rate_limited"
    | "unreachable"
    | "provider_error"
    | "invalid_request";
  message: string;
};

export type ProviderResult = ProviderSuccess | ProviderFailure;

export interface SceneMediaProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapability[];
  availability(): ProviderAvailability;
  generate(request: GenerationRequest): Promise<ProviderResult>;
}
