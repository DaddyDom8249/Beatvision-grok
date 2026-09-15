/**
 * BeatVision Arena gateway provider (server-side only).
 * Canonical runtime configuration: ARENA_WORKER_URL + GATEWAY_TOKEN.
 * Contract: BeatVision 1.1. Generation operation: sceneImages.
 */

import type {
  GenerationRequest,
  GenerationWorldContext,
  ProviderAvailability,
  ProviderResult,
  SceneMediaProvider,
} from "./types.ts";
import {
  ARENA_WORKER_URL,
  GATEWAY_TOKEN,
  arenaAuthHeaders,
  arenaRuntimeConfigStatus,
} from "./arena-runtime-config.ts";

const CONTRACT = "1.1";
const PROVIDER_ID = "beatvision-arena" as const;

export { arenaRuntimeConfigStatus };

function arenaBaseUrl(): string {
  return ARENA_WORKER_URL.replace(/\/+$/, "");
}

function arenaTokenConfigured(): boolean {
  return Boolean(GATEWAY_TOKEN);
}

export function buildArenaScenePayload(ctx: GenerationWorldContext) {
  const s = ctx.scene;
  const env =
    ctx.world.environments?.find((e) => e.id === s.environmentId) ?? null;
  const chars =
    s.characters ??
    ctx.world.characters?.filter((c) => s.characterIds.includes(c.id)) ??
    [];

  return {
    scene: s.sceneNumber,
    beatId: s.id,
    startTime: s.startSec,
    endTime: s.endSec,
    duration_seconds: Math.max(0.1, s.endSec - s.startSec),
    start_time: s.startSec,
    end_time: s.endSec,
    musicalSection: s.sectionLabel ?? s.sectionId,
    musical_section: s.sectionLabel ?? s.sectionId,
    purpose: s.summary ?? s.id,
    visualPurpose: s.summary ?? s.id,
    visual_purpose: s.summary ?? s.id,
    visualEvent: s.summary ?? s.id,
    visual_event: s.summary ?? s.id,
    description: s.summary ?? s.id,
    environment: env?.name ?? s.environmentName ?? s.environmentId,
    environmentDescription:
      env?.description ?? s.environmentDescription ?? "",
    characters: chars.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      description: c.description,
      continuityNotes: c.continuityNotes,
    })),
    cameraLanguage: `${s.camera.scale} / ${s.camera.move} / ${s.camera.energyBand}`,
    camera_language: `${s.camera.scale} / ${s.camera.move} / ${s.camera.energyBand}`,
    camera: s.camera,
    previousBeat: s.previousSceneId ?? null,
    previous_beat: s.previousSceneId ?? null,
    nextBeat: s.nextSceneId ?? null,
    next_beat: s.nextSceneId ?? null,
    reusePolicy: "new_visual_event",
    reuse_policy: "new_visual_event",
  };
}

export function buildArenaSceneImagesBody(
  request: GenerationRequest,
  ctx: GenerationWorldContext
) {
  const styleBible = ctx.world.styleBible;
  const style = [
    styleBible?.overallLook,
    styleBible?.colorPalette,
    styleBible?.lightingRules,
    styleBible?.cameraLanguage,
    styleBible?.textureAndGrain,
    styleBible?.doNot ? `Do not: ${styleBible.doNot}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const world = {
    character_concept: (ctx.world.characters ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      description: c.description,
      continuityNotes: c.continuityNotes,
    })),
    locations: (ctx.world.environments ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      whenUsed: e.whenUsed,
    })),
    visual_motifs: [],
    continuity_rules: [
      ctx.world.visualRules?.continuity,
      ctx.world.visualRules?.camera,
      ctx.world.visualRules?.lighting,
      ctx.world.visualRules?.forbidden
        ? `Forbidden: ${ctx.world.visualRules.forbidden}`
        : "",
    ].filter(Boolean),
    report: ctx.world.report ?? null,
    styleBible: ctx.world.styleBible ?? null,
    visualRules: ctx.world.visualRules ?? null,
    lockedAt: ctx.world.lockedAt ?? null,
  };

  const payload: Record<string, unknown> = {
    storyboard: { scenes: [buildArenaScenePayload(ctx)] },
    world,
    style,
    song: {
      title: ctx.title,
      artist: ctx.artist,
      lyrics: ctx.lyrics ?? "",
      creativeDirection: ctx.creativeDirection ?? "",
    },
    project_id: request.projectId,
    scene_id: request.sceneId,
    brief: request.brief,
  };

  if (ctx.durationSec != null && ctx.durationSec > 0) {
    payload.song_duration_seconds = ctx.durationSec;
    payload.songDuration = ctx.durationSec;
  }

  return {
    operation: "sceneImages",
    contract_version: CONTRACT,
    payload,
  };
}

function mapHttpError(status: number, body: unknown): ProviderResult {
  const message =
    typeof body === "object" &&
    body &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
      ? (body as { error: string }).error
      : `Arena HTTP ${status}`;

  if (status === 401 || status === 403) {
    return {
      ok: false,
      provider: PROVIDER_ID,
      code: "missing_credentials",
      message,
    };
  }
  if (status === 400 || status === 422) {
    return {
      ok: false,
      provider: PROVIDER_ID,
      code: "invalid_request",
      message,
    };
  }
  if (status === 429) {
    return {
      ok: false,
      provider: PROVIDER_ID,
      code: "rate_limited",
      message,
    };
  }
  return {
    ok: false,
    provider: PROVIDER_ID,
    code: status >= 500 ? "provider_error" : "provider_error",
    message,
  };
}

export function normalizeArenaSceneImagesResponse(
  data: unknown
): ProviderResult {
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      provider: PROVIDER_ID,
      code: "provider_error",
      message: "Malformed Arena JSON response.",
    };
  }

  const body = data as Record<string, unknown>;
  if (body.ok === false) {
    return {
      ok: false,
      provider: PROVIDER_ID,
      code: "provider_error",
      message: String(body.error ?? "Arena reported failure"),
    };
  }

  const result = body.result as Record<string, unknown> | undefined;
  const images = Array.isArray(result?.images) ? result.images : [];
  const first = images[0] as Record<string, unknown> | undefined;
  const url =
    first && typeof first.image_url === "string" ? first.image_url : null;

  if (!url) {
    return {
      ok: false,
      provider: PROVIDER_ID,
      code: "provider_error",
      message: "Arena returned success without an image URL.",
    };
  }

  return {
    ok: true,
    provider: PROVIDER_ID,
    kind: "image",
    url,
    mimeType: "image/png",
    width: 1024,
    height: 576,
    meta: {
      request_id: body.request_id ?? null,
      model: body.model ?? first.model ?? null,
      scene: first.scene ?? null,
      beatId: first.beatId ?? null,
      provider: body.provider ?? "pixazo",
      latency_ms: body.latency_ms ?? null,
      contract_version: body.contract_version ?? CONTRACT,
      capability: body.capability ?? "image",
      models_used: result?.models_used ?? null,
      free_only: result?.free_only ?? null,
      durable: false,
      storage_note:
        "URL is provider-hosted from Arena/Pixazo; not copied into Grok durable object storage in this phase.",
      arena_raw_image: first,
    },
  };
}

export const arenaProvider: SceneMediaProvider = {
  id: PROVIDER_ID,
  capabilities: ["still_image"],

  availability(): ProviderAvailability {
    if (!ARENA_WORKER_URL) {
      return {
        available: false,
        provider: PROVIDER_ID,
        code: "not_configured",
        reason: "ARENA_WORKER_URL is not set.",
      };
    }
    if (!arenaTokenConfigured()) {
      return {
        available: false,
        provider: PROVIDER_ID,
        code: "missing_credentials",
        reason:
          "GATEWAY_TOKEN is not set. Arena requires Authorization Bearer for provider operations.",
      };
    }
    return {
      available: true,
      provider: PROVIDER_ID,
      capabilities: ["still_image"],
    };
  },

  async checkAvailability(): Promise<ProviderAvailability> {
    const base = arenaBaseUrl();
    if (!base) {
      return {
        available: false,
        provider: PROVIDER_ID,
        code: "not_configured",
        reason: "ARENA_WORKER_URL is not set.",
      };
    }
    if (!arenaTokenConfigured()) {
      return {
        available: false,
        provider: PROVIDER_ID,
        code: "missing_credentials",
        reason:
          "GATEWAY_TOKEN is not set. Arena requires Authorization Bearer for provider operations.",
      };
    }

    try {
      const res = await fetch(`${base}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        return {
          available: false,
          provider: PROVIDER_ID,
          code: "unreachable",
          reason: `Arena /health returned HTTP ${res.status}.`,
        };
      }

      const data = (await res.json()) as { ok?: boolean };
      if (data.ok !== true) {
        return {
          available: false,
          provider: PROVIDER_ID,
          code: "unreachable",
          reason: "Arena /health did not report online.",
        };
      }

      return {
        available: true,
        provider: PROVIDER_ID,
        capabilities: ["still_image"],
      };
    } catch (error) {
      return {
        available: false,
        provider: PROVIDER_ID,
        code: "unreachable",
        reason:
          error instanceof Error
            ? `Arena unreachable: ${error.message}`
            : "Arena unreachable.",
      };
    }
  },

  async generate(request: GenerationRequest): Promise<ProviderResult> {
    if (request.capability !== "still_image") {
      return {
        ok: false,
        provider: PROVIDER_ID,
        code: "unsupported",
        message: `Arena provider does not advertise capability "${request.capability}" in this integration phase.`,
      };
    }
    if (!request.context) {
      return {
        ok: false,
        provider: PROVIDER_ID,
        code: "invalid_request",
        message:
          "Generation context (locked world + scene) is required for Arena sceneImages.",
      };
    }

    const base = arenaBaseUrl();
    if (!base) {
      return {
        ok: false,
        provider: PROVIDER_ID,
        code: "not_configured",
        message: "ARENA_WORKER_URL is not set.",
      };
    }
    if (!arenaTokenConfigured()) {
      return {
        ok: false,
        provider: PROVIDER_ID,
        code: "missing_credentials",
        message: "GATEWAY_TOKEN is not set.",
      };
    }

    const body = buildArenaSceneImagesBody(request, request.context);
    const requestId = request.requestId || crypto.randomUUID();

    try {
      const headers = arenaAuthHeaders(requestId);
      const response = await fetch(`${base}/v1/image/scenes`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch {
        return response.ok
          ? {
              ok: false,
              provider: PROVIDER_ID,
              code: "provider_error",
              message: "Malformed Arena JSON response.",
            }
          : mapHttpError(response.status, { error: text.slice(0, 500) });
      }

      if (!response.ok) return mapHttpError(response.status, data);

      const normalized = normalizeArenaSceneImagesResponse(data);
      if (normalized.ok && normalized.meta) {
        normalized.meta = {
          ...normalized.meta,
          client_request_id: requestId,
          startSec: request.startSec,
          endSec: request.endSec,
          sceneId: request.sceneId,
          projectId: request.projectId,
        };
      }
      return normalized;
    } catch (error) {
      return {
        ok: false,
        provider: PROVIDER_ID,
        code: "unreachable",
        message:
          error instanceof Error
            ? `Arena request failed: ${error.message}`
            : "Arena request failed.",
      };
    }
  },
};
