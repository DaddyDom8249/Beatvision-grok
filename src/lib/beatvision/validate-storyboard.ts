/**
 * Pure storyboard validator.
 * Hard errors block lock / generation. Warnings are advisory.
 * Does not invent provider output or mutate state.
 */

import {
  CAMERA_MOVE_MIN_DURATION,
  SECTION_DEFAULT_ENERGY,
  type CameraMove,
  type LockedWorld,
  type SongTimeline,
  type Storyboard,
  type StoryboardScene,
  type ValidationIssue,
  type ValidationResult,
} from "./types";

const DEFAULT_ALLOWED_MOVES: CameraMove[] = [
  "static",
  "slow_push",
  "slow_pull",
  "lateral_track",
];

function durationOf(scene: StoryboardScene): number {
  return Math.max(0, scene.endSec - scene.startSec);
}

function sectionById(timeline: SongTimeline, id: string) {
  return timeline.sections.find((s) => s.id === id);
}

/**
 * Validate storyboard against song master timeline and locked world.
 */
export function validateStoryboard(
  song: SongTimeline,
  world: LockedWorld,
  storyboard: Storyboard
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const characterIds = new Set(world.characters.map((c) => c.id));
  const environmentIds = new Set(world.environments.map((e) => e.id));
  const sectionIds = new Set(song.sections.map((s) => s.id));

  const allowedMoves =
    world.styleBible.allowedMoves && world.styleBible.allowedMoves.length > 0
      ? world.styleBible.allowedMoves
      : DEFAULT_ALLOWED_MOVES;

  const allowedScales =
    world.styleBible.allowedScales && world.styleBible.allowedScales.length > 0
      ? new Set(world.styleBible.allowedScales)
      : null;

  const scenes = [...storyboard.scenes].sort(
    (a, b) => a.startSec - b.startSec || a.endSec - b.endSec
  );

  if (scenes.length === 0) {
    errors.push({
      code: "EMPTY_STORYBOARD",
      severity: "error",
      message: "Storyboard has no scenes.",
    });
    return { ok: false, errors, warnings };
  }

  // --- Per-scene checks ---
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const idx = storyboard.scenes.findIndex((s) => s.id === scene.id);
    const sceneIndex = idx >= 0 ? idx : i;

    if (!(scene.endSec > scene.startSec)) {
      errors.push({
        code: "INVALID_DURATION",
        severity: "error",
        message: `Scene "${scene.id}" endSec must be greater than startSec.`,
        sceneId: scene.id,
        sceneIndex,
      });
    }

    if (scene.startSec < 0 || scene.endSec > song.durationSec + 1e-6) {
      errors.push({
        code: "OUTSIDE_SONG",
        severity: "error",
        message: `Scene "${scene.id}" [${scene.startSec}, ${scene.endSec}) is outside song duration ${song.durationSec}s.`,
        sceneId: scene.id,
        sceneIndex,
      });
    }

    if (!sectionIds.has(scene.sectionId)) {
      errors.push({
        code: "UNKNOWN_SECTION",
        severity: "error",
        message: `Scene "${scene.id}" references unknown sectionId "${scene.sectionId}".`,
        sceneId: scene.id,
        sceneIndex,
      });
    } else {
      const section = sectionById(song, scene.sectionId)!;
      // Scene should mostly live inside its section (allow tiny float epsilon)
      if (
        scene.startSec < section.startSec - 1e-3 ||
        scene.endSec > section.endSec + 1e-3
      ) {
        errors.push({
          code: "SECTION_MISMATCH",
          severity: "error",
          message: `Scene "${scene.id}" timing does not fit section "${section.id}" [${section.startSec}, ${section.endSec}).`,
          sceneId: scene.id,
          sceneIndex,
        });
      }

      const expectedEnergy = SECTION_DEFAULT_ENERGY[section.kind];
      if (
        scene.camera.energyBand !== expectedEnergy &&
        !(section.kind === "bridge" && scene.camera.energyBand === "high")
      ) {
        warnings.push({
          code: "ENERGY_BAND_UNEXPECTED",
          severity: "warning",
          message: `Scene "${scene.id}" energyBand "${scene.camera.energyBand}" differs from default for ${section.kind} ("${expectedEnergy}").`,
          sceneId: scene.id,
          sceneIndex,
        });
      }
    }

    if (!environmentIds.has(scene.environmentId)) {
      errors.push({
        code: "UNKNOWN_ENVIRONMENT",
        severity: "error",
        message: `Scene "${scene.id}" references environmentId "${scene.environmentId}" not in locked world.`,
        sceneId: scene.id,
        sceneIndex,
      });
    }

    for (const cid of scene.characterIds) {
      if (!characterIds.has(cid)) {
        errors.push({
          code: "UNKNOWN_CHARACTER",
          severity: "error",
          message: `Scene "${scene.id}" references characterId "${cid}" not in locked world.`,
          sceneId: scene.id,
          sceneIndex,
        });
      }
    }

    if (!allowedMoves.includes(scene.camera.move)) {
      errors.push({
        code: "CAMERA_MOVE_FORBIDDEN",
        severity: "error",
        message: `Scene "${scene.id}" camera move "${scene.camera.move}" is not allowed by Style Bible.`,
        sceneId: scene.id,
        sceneIndex,
      });
    }

    if (allowedScales && !allowedScales.has(scene.camera.scale)) {
      errors.push({
        code: "CAMERA_SCALE_FORBIDDEN",
        severity: "error",
        message: `Scene "${scene.id}" shot scale "${scene.camera.scale}" is not allowed by Style Bible.`,
        sceneId: scene.id,
        sceneIndex,
      });
    }

    const minDur = CAMERA_MOVE_MIN_DURATION[scene.camera.move];
    const dur = durationOf(scene);
    if (dur + 1e-6 < minDur) {
      errors.push({
        code: "CAMERA_MOVE_TOO_SHORT",
        severity: "error",
        message: `Scene "${scene.id}" duration ${dur.toFixed(2)}s is too short for move "${scene.camera.move}" (min ${minDur}s).`,
        sceneId: scene.id,
        sceneIndex,
      });
    }

    // Media integrity (no-fake alignment)
    if (scene.mediaAssetId && scene.reuseMediaFromSceneId) {
      const source = storyboard.scenes.find(
        (s) => s.id === scene.reuseMediaFromSceneId
      );
      if (!source) {
        errors.push({
          code: "REUSE_SOURCE_MISSING",
          severity: "error",
          message: `Scene "${scene.id}" reuses media from missing scene "${scene.reuseMediaFromSceneId}".`,
          sceneId: scene.id,
          sceneIndex,
        });
      } else if (
        source.mediaAssetId &&
        source.mediaAssetId !== scene.mediaAssetId
      ) {
        errors.push({
          code: "REUSE_ASSET_MISMATCH",
          severity: "error",
          message: `Scene "${scene.id}" mediaAssetId does not match source scene "${scene.reuseMediaFromSceneId}".`,
          sceneId: scene.id,
          sceneIndex,
        });
      }
    }

    // Silent recycle detection: same mediaAssetId on multiple scenes without reuse flag
    if (scene.mediaAssetId && !scene.reuseMediaFromSceneId) {
      const others = storyboard.scenes.filter(
        (s) =>
          s.id !== scene.id &&
          s.mediaAssetId === scene.mediaAssetId &&
          !s.reuseMediaFromSceneId
      );
      if (others.length > 0) {
        errors.push({
          code: "SILENT_MEDIA_RECYCLE",
          severity: "error",
          message: `Scene "${scene.id}" shares mediaAssetId with other scenes without explicit reuse authorization.`,
          sceneId: scene.id,
          sceneIndex,
        });
      }
    }
  }

  // --- Overlaps ---
  for (let i = 0; i < scenes.length - 1; i++) {
    const a = scenes[i];
    const b = scenes[i + 1];
    if (a.endSec > b.startSec + 1e-6) {
      errors.push({
        code: "SCENE_OVERLAP",
        severity: "error",
        message: `Scenes "${a.id}" and "${b.id}" overlap in time.`,
        sceneId: a.id,
      });
    }
  }

  // --- Coverage (optional gap warning) ---
  const covered = scenes.reduce((sum, s) => sum + durationOf(s), 0);
  if (covered > song.durationSec + 1e-3) {
    errors.push({
      code: "COVERAGE_EXCEEDS_SONG",
      severity: "error",
      message: `Total scene duration ${covered.toFixed(2)}s exceeds song duration ${song.durationSec}s.`,
    });
  } else if (covered < song.durationSec - 0.5) {
    warnings.push({
      code: "COVERAGE_GAP",
      severity: "warning",
      message: `Storyboard covers ${covered.toFixed(2)}s of ${song.durationSec}s song; gaps remain.`,
    });
  }

  // Gaps between consecutive scenes
  for (let i = 0; i < scenes.length - 1; i++) {
    const gap = scenes[i + 1].startSec - scenes[i].endSec;
    if (gap > 0.05) {
      warnings.push({
        code: "TIMELINE_GAP",
        severity: "warning",
        message: `Gap of ${gap.toFixed(2)}s between scenes "${scenes[i].id}" and "${scenes[i + 1].id}".`,
        sceneId: scenes[i].id,
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/** Convenience: only errors (for lock/generation gates). */
export function storyboardIsValid(
  song: SongTimeline,
  world: LockedWorld,
  storyboard: Storyboard
): boolean {
  return validateStoryboard(song, world, storyboard).ok;
}
