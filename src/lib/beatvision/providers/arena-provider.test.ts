/**
 * Arena provider unit tests — mocked HTTP only (no real Pixazo credits).
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  arenaProvider,
  buildArenaSceneImagesBody,
  normalizeArenaSceneImagesResponse,
} from "./arena-provider.ts";
import { resolveProvider } from "./registry.ts";
import type { GenerationRequest, GenerationWorldContext } from "./types.ts";

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

describe("buildArenaSceneImagesBody", () => {
  it("sends exactly one scene for sceneImages",
    () => {
      const body = buildArenaSceneImagesBody(baseRequest(), sampleContext);
      assert.equal(body.operation, "sceneImages");
      assert.equal(body.contract_version, "1.1");
      const scenes = (body.payload as { storyboard: { scenes: unknown[] } })
        .storyboard.scenes;
      assert.equal(scenes.length, 1);
    });

  it("preserves start/end timeline on the scene",
    () => {
      const body = buildArenaSceneImagesBody(baseRequest(), sampleContext);
      const scene = (
        body.payload as { storyboard: { scenes: Array<{ startTime: number; endTime: number }> } }
      ).storyboard.scenes[0];
      assert.equal(scene.startTime, 0);
      assert.equal(scene.endTime, 12);
    });
});

describe("normalizeArenaSceneImagesResponse", () => {
  it("normalizes successful image response",
    () => {
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

  it("fails on malformed JSON shape",
    () => {
      const result = normalizeArenaSceneImagesResponse(null);
      assert.equal(result.ok, false);
    });

  it("fails when ok false",
    () => {
      const result = normalizeArenaSceneImagesResponse({
        ok: false,
        error: "nope",
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.message, /nope/);
    });

  it("fails when image URL missing",
    () => {
      const result = normalizeArenaSceneImagesResponse({
        ok: true,
        result: { images: [{ scene: 1 }] },
      });
      assert.equal(result.ok, false);
    });
});

describe("resolveProvider", () => {
  it("prefers beatvision-arena over null when credentials look present",
    () => {
      const prevUrl = process.env.BEATVISION_ARENA_URL;
      const prevTok = process.env.BEATVISION_ARENA_TOKEN;
      process.env.BEATVISION_ARENA_URL =
        "https://beatvision-provider-arena.richardcranium466.workers.dev";
      process.env.BEATVISION_ARENA_TOKEN = "test-token";
      try {
        const { provider, availability } = resolveProvider("still_image");
        assert.equal(provider.id, "beatvision-arena");
        assert.equal(availability.available, true);
      } finally {
        if (prevUrl === undefined) delete process.env.BEATVISION_ARENA_URL;
        else process.env.BEATVISION_ARENA_URL = prevUrl;
        if (prevTok === undefined) delete process.env.BEATVISION_ARENA_TOKEN;
        else process.env.BEATVISION_ARENA_TOKEN = prevTok;
      }
    });

  it("does not let null override arena when arena is configured but missing token",
    () => {
      const prevUrl = process.env.BEATVISION_ARENA_URL;
      const prevTok = process.env.BEATVISION_ARENA_TOKEN;
      process.env.BEATVISION_ARENA_URL =
        "https://beatvision-provider-arena.richardcranium466.workers.dev";
      delete process.env.BEATVISION_ARENA_TOKEN;
      try {
        const { provider, availability } = resolveProvider("still_image");
        assert.equal(provider.id, "beatvision-arena");
        assert.equal(availability.available, false);
        if (!availability.available) {
          assert.equal(availability.code, "missing_credentials");
        }
      } finally {
        if (prevUrl === undefined) delete process.env.BEATVISION_ARENA_URL;
        else process.env.BEATVISION_ARENA_URL = prevUrl;
        if (prevTok === undefined) delete process.env.BEATVISION_ARENA_TOKEN;
        else process.env.BEATVISION_ARENA_TOKEN = prevTok;
      }
    });
});

describe("arenaProvider.generate (mocked fetch)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    process.env.BEATVISION_ARENA_URL =
      "https://beatvision-provider-arena.richardcranium466.workers.dev";
    process.env.BEATVISION_ARENA_TOKEN = "test-token";
  });

  it("maps successful Arena response",
    async () => {
      globalThis.fetch = (async () =>
        new Response(
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
        )) as typeof fetch;

      const result = await arenaProvider.generate(baseRequest());
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.url, "https://cdn.example/a.png");
        assert.equal(result.provider, "beatvision-arena");
      }
    });

  it("maps 401 to missing_credentials",
    async () => {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
        })) as typeof fetch;
      const result = await arenaProvider.generate(baseRequest());
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "missing_credentials");
    });

  it("maps 422 to invalid_request",
    async () => {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: "Storyboard failed deterministic integrity validation.",
          }),
          { status: 422 }
        )) as typeof fetch;
      const result = await arenaProvider.generate(baseRequest());
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "invalid_request");
    });

  it("maps network failure to unreachable",
    async () => {
      globalThis.fetch = (async () => {
        throw new Error("network down");
      }) as typeof fetch;
      const result = await arenaProvider.generate(baseRequest());
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, "unreachable");
    });

  it("rejects unsupported capability without calling generation semantics as success",
    async () => {
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

  it("checkAvailability uses /health only",
    async () => {
      const urls: string[] = [];
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return new Response(
          JSON.stringify({
            ok: true,
            status: "online",
            contract_version: "1.1",
          }),
          { status: 200 }
        );
      }) as typeof fetch;
      const avail = await arenaProvider.checkAvailability!();
      assert.equal(avail.available, true);
      assert.ok(urls[0]?.includes("/health"));
      assert.ok(!urls.some((u) => u.includes("sceneImages")));
    });
});
