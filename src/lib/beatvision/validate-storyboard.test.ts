/**
 * Node test runner: npm test already uses node --test on selected paths.
 * This file is self-contained for local/node --test when wired.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateStoryboard } from "./validate-storyboard";
import type { LockedWorld, SongTimeline, Storyboard } from "./types";

const song: SongTimeline = {
  durationSec: 60,
  sections: [
    { id: "s-intro", kind: "intro", startSec: 0, endSec: 8 },
    { id: "s-verse", kind: "verse", startSec: 8, endSec: 28 },
    { id: "s-chorus", kind: "chorus", startSec: 28, endSec: 48 },
    { id: "s-outro", kind: "outro", startSec: 48, endSec: 60 },
  ],
};

const world: LockedWorld = {
  lockedAt: Date.now(),
  styleBible: {
    overallLook: "cinematic",
    colorPalette: "muted",
    lightingRules: "motivated",
    cameraLanguage: "slow pushes",
    textureAndGrain: "film",
    doNot: "no random orbits",
    allowedMoves: ["static", "slow_push", "slow_pull", "lateral_track"],
    allowedScales: ["wide", "medium", "close"],
  },
  characters: [
    {
      id: "char-1",
      name: "Lead",
      role: "performer",
      description: "lead",
      continuityNotes: "consistent",
    },
  ],
  environments: [
    {
      id: "env-1",
      name: "Primary",
      description: "main space",
      whenUsed: "verses and core",
    },
  ],
  visualRules: {
    continuity: "persist",
    camera: "motivated",
    lighting: "motivated",
    forbidden: "no fake media",
  },
};

function baseScene(
  partial: Partial<Storyboard["scenes"][0]> & { id: string }
): Storyboard["scenes"][0] {
  return {
    startSec: 8,
    endSec: 16,
    sectionId: "s-verse",
    environmentId: "env-1",
    characterIds: ["char-1"],
    camera: {
      scale: "medium",
      move: "static",
      energyBand: "low",
    },
    ...partial,
  };
}

describe("validateStoryboard", () => {
  it("passes a minimal valid board",
    () => {
      const board: Storyboard = {
        scenes: [
          baseScene({ id: "sc1", startSec: 8, endSec: 20 }),
          baseScene({
            id: "sc2",
            startSec: 28,
            endSec: 40,
            sectionId: "s-chorus",
            camera: {
              scale: "close",
              move: "slow_push",
              energyBand: "high",
            },
          }),
        ],
      };
      const result = validateStoryboard(song, world, board);
      assert.equal(result.ok, true);
      assert.equal(result.errors.length, 0);
    });

  it("rejects unknown character",
    () => {
      const board: Storyboard = {
        scenes: [
          baseScene({ id: "sc1", characterIds: ["char-missing"] }),
        ],
      };
      const result = validateStoryboard(song, world, board);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "UNKNOWN_CHARACTER"));
    });

  it("rejects forbidden camera move",
    () => {
      const board: Storyboard = {
        scenes: [
          baseScene({
            id: "sc1",
            startSec: 8,
            endSec: 20,
            camera: {
              scale: "medium",
              move: "orbit",
              energyBand: "low",
            },
          }),
        ],
      };
      const result = validateStoryboard(song, world, board);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "CAMERA_MOVE_FORBIDDEN"));
    });

  it("rejects move too short for slow_push",
    () => {
      const board: Storyboard = {
        scenes: [
          baseScene({
            id: "sc1",
            startSec: 8,
            endSec: 10,
            camera: {
              scale: "medium",
              move: "slow_push",
              energyBand: "low",
            },
          }),
        ],
      };
      const result = validateStoryboard(song, world, board);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "CAMERA_MOVE_TOO_SHORT"));
    });

  it("rejects overlapping scenes",
    () => {
      const board: Storyboard = {
        scenes: [
          baseScene({ id: "sc1", startSec: 8, endSec: 18 }),
          baseScene({ id: "sc2", startSec: 16, endSec: 24 }),
        ],
      };
      const result = validateStoryboard(song, world, board);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "SCENE_OVERLAP"));
    });

  it("rejects silent media recycle",
    () => {
      const board: Storyboard = {
        scenes: [
          baseScene({
            id: "sc1",
            startSec: 8,
            endSec: 16,
            mediaAssetId: "asset-a",
          }),
          baseScene({
            id: "sc2",
            startSec: 16,
            endSec: 24,
            mediaAssetId: "asset-a",
          }),
        ],
      };
      const result = validateStoryboard(song, world, board);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === "SILENT_MEDIA_RECYCLE"));
    });
});
