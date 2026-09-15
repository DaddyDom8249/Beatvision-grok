/** Arena provider unit tests — mocked HTTP only (no real provider credits). */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  arenaProvider,
  buildArenaSceneImagesBody,
  normalizeArenaSceneImagesResponse,
  arenaRuntimeConfigStatus,
} from "./arena-provider.ts";
import { resolveProvider } from "./registry.ts";
import type { GenerationRequest, GenerationWorldContext } from "./types.ts";

const ARENA_URL =
  "https://beatvision-provider-arena.richardcranium466.workers.dev";

const sampleContext: GenerationWorldContext = {
  title: "Test Song",
  artist: "Test Artist",
  lyrics: "hello world",
  creativeDirection: "noir",
  durationSec: 120,
  scene: {
    id: "scene-1",
    startSec: 0,
    endSec: 12,
    sectionId: "sec-intro-0",
    sectionLabel: "Intro",
    environmentId: "env-1",
    environmentName: "Warehouse",
    environmentDescription: "Dark industrial space",
    characterIds: ["char-1"],
    characters: [
      {
        id: "char-1",
        name: "Lead",
        role: "protagonist",
        description: "Figure in coat",
        continuityNotes: "Same coat",
      },
    ],
    camera: { scale: "wide", move: "static", energyBand: "low" },
    summary: "Opening establishing shot",
    previousSceneId: null,
    nextSceneId: "scene-2",
    sceneNumber: 1,
    totalScenes: 2,
  },
  world: {
    styleBible: {
      overallLook: "cinematic noir",
      colorPalette: "cold blues",
      lightingRules: "hard side light",
      cameraLanguage: "slow moves",
      textureAndGrain: "16mm",
      doNot: "no text",
    },
    characters: [
      {
        id: "char-1",
        name: "Lead",
        role: "protagonist",
        description: "Figure in coat",
        continuityNotes: "Same coat",
      },
    ],
    environments: [
      {
        id: "env-1",
        name: "Warehouse",
        description: "Dark industrial space",
        whenUsed: "verses",
      },
    ],
    visualRules: { continuity: "same character", forbidden: "no logos" },
    lockedAt: Date.now(),
  },
};

function baseRequest(over: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    projectId: "proj-1",
    sceneId: "scene-1",
    brief: "Opening establishing shot",
    startSec: 0,
    endSec: 12,
    capability: "still_image",
    context: sampleContext,
    ...over,
  };
}

describe("canonical Arena runtime configuration", () => {
  it("reports both canonical variables when present", () => {
    const previousUrl = process.env.ARENA_WORKER_URL;
    const previousToken = process.env.GATEWAY_TOKEN;
    process.env.ARENA_WORKER_URL = ARENA_URL;
    process.env.GATEWAY_TOKEN = "test-token";
    try {
      const status = arenaRuntimeConfigStatus();
      assert.equal(status.arenaUrlConfigured, true);
      assert.equal(status.gatewayTokenConfigured, true);
    } finally {
      if (previousUrl === undefined) delete process.env.ARENA_WORKER_URL;
      else process.env.ARENA_WORKER_URL = previousUrl;
      if (previousToken === undefined) delete process.env.GATEWAY_TOKEN;
      else process.env.GATEWAY_TOKEN = previousToken;
    }
  });
});

describe("buildArenaSceneImagesBody", () => {
  it("sends exactly one scene for sceneImages", () => {
    const body = buildArenaSceneImagesBody(baseRequest(), sampleContext);
    assert.equal(body.operation, "sceneImages");
    assert.equal(body.contract_version, "1.1");
    const scenes = (body.payload as { storyboard: { scenes: unknown[] } })
      .storyboard.scenes;
    assert.equal(scenes.length, 1);
  });

  it("preserves start/end timeline on the scene", () => {
    const body = buildArenaSceneImagesBody(baseRequest(), sampleContext);
    const scene = (
      body.payload as {
        storyboard: { scenes: Array<{ startTime: number; endTime: number }> };
      }
    ).storyboard.scenes[0];
    assert.equal(scene.startTime, 0);
    assert.equal(scene.endTime, 12);
  });
});

describe("normalizeArenaSceneImagesResponse", () => {
  it("normalizes successful image response", () => {
    const result = normalizeArenaSceneImagesResponse({
      ok: true,
      contract_version: "1.1",
      capability: "image",
      provider: "pixazo",
      model: "sdxl",
      request_id: "req-1",
      latency_ms: 42,
      result: {
        images: [
          {
            scene: 1,
            beatId: "scene-1",
            status: "generated",
            image_url: "https://example.com/img.png",
            model: "sdxl",
          },
        ],
        models_used: ["sdxl"],
        scene_count: 1,
        free_only: true,
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.provider, "beatvision-arena");
      assert.equal(result.kind, "image");
      assert.equal(result.url, "https://example.com/img.png");
      assert.equal(result.meta?.request_id, "req-1");
      assert.equal(result.meta?.durable, false);
    }
  });

  it("fails on malformed JSON shape", () => {
    const result = normalizeArenaSceneImagesResponse(null);
    assert.equal(result.ok, false);
  });

  it("fails when ok false", () => {
    const result = normalizeArenaSceneImagesResponse({ ok: false, error: "nope" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /nope/);
  });

  it("fails when image URL missing", () => {
    const result = normalizeArenaSceneImagesResponse({
      ok: true,
      result: { images: [{ scene: 1 }] },
    });
    assert.equal(result.ok, false);
  });
});

describe("resolveProvider", () => {
  it("prefers beatvision-arena when canonical credentials are present", () => {
    const previousUrl = process.env.ARENA_WORKER_URL;
    const previousToken = process.env.GATEWAY_TOKEN;
    process.env.ARENA_WORKER_URL = ARENA_URL;
    process.env.GATEWAY_TOKEN = "test-token";
    try {
      const { provider, availability } = resolveProvider("still_image");
      assert.equal(provider.id, "beatvision-arena");
      assert.equal(availability.available, true);
    } finally {
      if (previousUrl === undefined) delete process.env.ARENA_WORKER_URL;
      else process.env.ARENA_WORKER_URL = previousUrl;
      if (previousToken === undefined) delete process.env.GATEWAY_TOKEN;
      else process.env.GATEWAY_TOKEN = previousToken;
    }
  });

  it("reports missing canonical token instead of falling through", () => {
    const previousUrl = process.env.ARENA_WORKER_URL;
    const previousToken = process.env.GATEWAY_TOKEN;
    process.env.ARENA_WORKER_URL = ARENA_URL;
    delete process.env.GATEWAY_TOKEN;
    try {
      const { provider, availability } = resolveProvider("still_image");
      assert.equal(provider.id, "beatvision-arena");
      assert.equal(availability.available, false);
      if (!availability.available) {
        assert.equal(availability.code, "missing_credentials");
      }
    } finally {
      if (previousUrl === undefined) delete process.env.ARENA_WORKER_URL;
      else process.env.ARENA_WORKER_URL = previousUrl;
      if (previousToken === undefined) delete process.env.GATEWAY_TOKEN;
      else process.env.GATEWAY_TOKEN = previousToken;
    }
  });
});

describe("arenaProvider.generate (mocked fetch)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.ARENA_WORKER_URL;
    delete process.env.GATEWAY_TOKEN;
  });

  beforeEach(() => {
    process.env.ARENA_WORKER_URL = ARENA_URL;
    process.env.GATEWAY_TOKEN = "test-token";
  });

  it("posts to the authenticated sceneImages endpoint", async () => {
    let requestUrl = "";
    let authorization = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestUrl = String(input);
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      return new Response(
        JSON.stringify({
          ok: true,
          contract_version: "1.1",
          provider: "pixazo",
          model: "sdxl",
          request_id: "r1",
          result: {
            images: [
              {
                scene: 1,
                beatId: "scene-1",
                image_url: "https://cdn.example/a.png",
                model: "sdxl",
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const result = await arenaProvider.generate(baseRequest());
    assert.equal(result.ok, true);
    assert.equal(requestUrl, `${ARENA_URL}/v1/image/scenes`);
    assert.equal(authorization, "Bearer test-token");
  });

  it("maps 401 to missing_credentials", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
      })
    ) as typeof fetch;
    const result = await arenaProvider.generate(baseRequest());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "missing_credentials");
  });

  it("maps 422 to invalid_request", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: "Storyboard failed deterministic integrity validation.",
        }),
        { status: 422 }
      )
    ) as typeof fetch;
    const result = await arenaProvider.generate(baseRequest());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "invalid_request");
  });

  it("maps network failure to unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const result = await arenaProvider.generate(baseRequest());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unreachable");
  });

  it("rejects unsupported capability", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch;
    const result = await arenaProvider.generate(
      baseRequest({ capability: "motion" })
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported");
    assert.equal(called, false);
  });

  it("checkAvailability uses /health only", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({ ok: true, status: "online", contract_version: "1.1" }),
        { status: 200 }
      );
    }) as typeof fetch;
    const availability = await arenaProvider.checkAvailability!();
    assert.equal(availability.available, true);
    assert.ok(urls[0]?.includes("/health"));
    assert.ok(!urls.some((url) => url.includes("sceneImages")));
  });
});
