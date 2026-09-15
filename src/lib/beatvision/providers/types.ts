/**
 * Provider contracts for BeatVision scene generation.
 * Implementations must never invent media or success.
 */

export type ProviderId =
  | "none"
  | "beatvision-arena"
  | "xai-image"
  | "external-video";

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

/**
 * Generation request. One job = one storyboard scene.
 * World/timeline context is required for Arena continuity.
 */
export type GenerationRequest = {
  projectId: string;
  sceneId: string;
  brief: string;
  startSec: number;
  endSec: number;
  capability: ProviderCapability;
  /** Idempotency key forwarded as X-BeatVision-Request when present */
  requestId?: string;
  /** Locked world + song context for Arena sceneImages payload */
  context?: GenerationWorldContext;
};

export type GenerationWorldContext = {
  title: string;
  artist: string;
  lyrics?: string;
  creativeDirection?: string;
  durationSec: number | null;
  scene: {
    id: string;
    startSec: number;
    endSec: number;
    sectionId: string;
    sectionLabel?: string;
    environmentId: string;
    environmentName?: string;
    environmentDescription?: string;
    characterIds: string[];
    characters?: Array<{ id: string; name: string; role: string; description: string; continuityNotes: string }>;
    camera: {
      scale: string;
      move: string;
      energyBand: string;
      notes?: string;
    };
    summary?: string;
    previousSceneId?: string | null;
    nextSceneId?: string | null;
    sceneNumber: number;
    totalScenes: number;
  };
  world: {
    report?: unknown;
    styleBible?: {
      overallLook?: string;
      colorPalette?: string;
      lightingRules?: string;
      cameraLanguage?: string;
      textureAndGrain?: string;
      doNot?: string;
    };
    characters?: Array<{ id: string; name: string; role: string; description: string; continuityNotes: string }>;
    environments?: Array<{ id: string; name: string; description: string; whenUsed: string }>;
    visualRules?: {
      continuity?: string;
      camera?: string;
      lighting?: string;
      forbidden?: string;
    };
    lockedAt?: number | null;
  };
};

export type ProviderSuccess = {
  ok: true;
  provider: ProviderId;
  kind: "image" | "video" | "audio" | "other";
  /** Provider-returned URL (may be temporary — see meta.durable) */
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
  /** Sync snapshot; may be conservative. Prefer checkAvailability when async is needed. */
  availability(): ProviderAvailability;
  /** Optional live check (health/capabilities). Must not trigger paid generation. */
  checkAvailability?(): Promise<ProviderAvailability>;
  generate(request: GenerationRequest): Promise<ProviderResult>;
}
