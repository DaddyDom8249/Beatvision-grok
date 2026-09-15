/** Arena provider unit tests — mocked HTTP only (no real provider credits). */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

const ARENA_URL =
  "https://beatvision-provider-arena.richardcranium466.workers.dev";

// The provider reads Cloudflare-compatible process.env during module initialization.
// Initialize the canonical names before importing it so local tests mirror Worker startup.
process.env.ARENA_WORKER_URL = ARENA_URL;
process.env.GATEWAY_TOKEN = "test-token";

const {
  arenaProvider,
  buildArenaSceneImagesBody,
  normalizeArenaSceneImagesResponse,
  arenaRuntimeConfigStatus,
} = await import("./arena-provider.ts");
const { resolveProvider } = await import("./registry.ts");

const sampleContext = {
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
    characters: [{
      id: "char-1",
      name: "Lead",
      role: "protagonist",
      description: "Figure in coat",
      continuityNotes: "Same coat",
    }],
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
    characters: [{
      id: "char-1",
      name: "Lead",
      role: "protagonist",
      description: "Figure in coat",
      continuityNotes: "Same coat",
    }],
    environments: [{
      id: "env-1",
      name: "Warehouse",
      description: "Dark industrial space",
      whenUsed: "verses",
    }],
    visualRules: { continuity: "same character", forbidden: "no logos" },
    lockedAt: Date.now(),
  },
};

function baseRequest(over = {}) {
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
  it("uses exactly the canonical names", () => {
    const status = arenaRuntimeConfigStatus();
    assert.equal(status.arenaUrlConfigured, true);
    assert.equal(status.gatewayTokenConfigured, true);
    assert.equal(process.env.BEATVISION_ARENA_URL, undefined);
    assert.equal(process.env.BEATVISION_ARENA_TOKEN, undefined);
  });
});

describe("buildArenaSceneImagesBody", () => {
  it("sends exactly one scene for sceneImages", () => {
    const body = buildArenaSceneImagesBody(baseRequest(), sampleContext);
    assert.equal(body.operation, "sceneImages");
    assert.equal(body.contract_version, "1.1");
    assert.equal((body.payload as { storyboard: { scenes: unknown[] } }).storyboard.scenes.length, 1);
  });

  it("preserves scene timeline", () => {
    const body = buildArenaSceneImagesBody(baseRequest(), sampleContext);
    const scene = (body.payload as { storyboard: { scenes: Array<{ startTime: number; endTime: number }> } }).storyboard.scenes[0];
    assert.equal(scene.startTime, 0);
    assert.equal(scene.endTime, 12);
  });
});

describe("normalizeArenaSceneImagesResponse", () => {
  it("normalizes a successful image response", () => {
    const result = normalizeArenaSceneImagesResponse({
      ok: true,
      contract_version: "1.1",
      provider: "pixazo",
      result: { images: [{ scene: 1, beatId: "scene-1", image_url: "https://example.com/img.png" }] },
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.url, "https://example.com/img.png");
  });

  it("fails malformed responses", () => {
    assert.equal(normalizeArenaSceneImagesResponse(null).ok, false);
    assert.equal(normalizeArenaSceneImagesResponse({ ok: true, result: { images: [] } }).ok, false);
  });
});

describe("resolveProvider", () => {
  it("prefers Arena with canonical configuration", () => {
    const { provider, availability } = resolveProvider("still_image");
    assert.equal(provider.id, "beatvision-arena");
    assert.equal(availability.available, true);
  });
});

describe("arenaProvider.generate", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      assert.equal(url, `${ARENA_URL}/v1/image/scenes`);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
      return new Response(JSON.stringify({
        ok: true,
        contract_version: "1.1",
        provider: "pixazo",
        result: { images: [{ scene: 1, beatId: "scene-1", image_url: "https://cdn.example/a.png" }] },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("uses the canonical URL and token for the authenticated scene endpoint", async () => {
    const result = await arenaProvider.generate(baseRequest());
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.url, "https://cdn.example/a.png");
  });

  it("maps unauthorized responses to missing_credentials", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 })) as typeof fetch;
    const result = await arenaProvider.generate(baseRequest());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "missing_credentials");
  });

  it("rejects unsupported capabilities without calling Arena", async () => {
    let called = false;
    globalThis.fetch = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
    const result = await arenaProvider.generate(baseRequest({ capability: "motion" }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "unsupported");
    assert.equal(called, false);
  });
});
