/**
 * BeatVision core types for song timeline, locked world, and storyboard.
 * Source of truth for continuity and validation.
 */

export type MusicalSectionKind =
  | "intro"
  | "verse"
  | "pre_chorus"
  | "chorus"
  | "bridge"
  | "outro"
  | "instrumental"
  | "transition";

export type CameraEnergyBand = "low" | "medium" | "rising" | "high" | "settled";

export type ShotScale =
  | "extreme_wide"
  | "wide"
  | "medium"
  | "medium_close"
  | "close"
  | "extreme_close";

export type CameraMove =
  | "static"
  | "slow_push"
  | "slow_pull"
  | "lateral_track"
  | "pan"
  | "tilt"
  | "orbit";

/** Minimum duration (seconds) required for a move to feel intentional. */
export const CAMERA_MOVE_MIN_DURATION: Record<CameraMove, number> = {
  static: 0,
  slow_push: 4,
  slow_pull: 4,
  lateral_track: 3,
  pan: 2,
  tilt: 2,
  orbit: 6,
};

/** Default energy band expectations per musical section. */
export const SECTION_DEFAULT_ENERGY: Record<MusicalSectionKind, CameraEnergyBand> =
  {
    intro: "low",
    verse: "low",
    pre_chorus: "rising",
    chorus: "high",
    bridge: "medium",
    outro: "settled",
    instrumental: "medium",
    transition: "rising",
  };

export type MusicalSection = {
  id: string;
  kind: MusicalSectionKind;
  /** Start time in seconds from song start */
  startSec: number;
  /** End time in seconds from song start (exclusive of next, inclusive of content) */
  endSec: number;
  label?: string;
};

export type SongTimeline = {
  /** Total duration in seconds; master clock */
  durationSec: number;
  sections: MusicalSection[];
};

export type StyleBible = {
  overallLook: string;
  colorPalette: string;
  lightingRules: string;
  cameraLanguage: string;
  textureAndGrain: string;
  doNot: string;
  /** Allowed scales; empty = all allowed */
  allowedScales?: ShotScale[];
  /** Allowed moves; empty = static + slow_push + slow_pull + lateral_track only */
  allowedMoves?: CameraMove[];
};

export type Character = {
  id: string;
  name: string;
  role: string;
  description: string;
  continuityNotes: string;
};

export type Environment = {
  id: string;
  name: string;
  description: string;
  whenUsed: string;
};

export type VisualRules = {
  continuity: string;
  camera: string;
  lighting: string;
  forbidden: string;
};

export type LockedWorld = {
  styleBible: StyleBible;
  characters: Character[];
  environments: Environment[];
  visualRules: VisualRules;
  lockedAt: number;
};

export type CameraIntent = {
  scale: ShotScale;
  move: CameraMove;
  energyBand: CameraEnergyBand;
  notes?: string;
};

export type StoryboardScene = {
  id: string;
  /** Inclusive start, seconds */
  startSec: number;
  /** Exclusive end, seconds */
  endSec: number;
  sectionId: string;
  environmentId: string;
  characterIds: string[];
  camera: CameraIntent;
  /** Optional: generation job id when real media exists */
  generationJobId?: string | null;
  /** Optional: media asset id; must not silently reuse another scene's without flag */
  mediaAssetId?: string | null;
  /** Explicit authorization to reuse media from another scene */
  reuseMediaFromSceneId?: string | null;
  summary?: string;
};

export type Storyboard = {
  scenes: StoryboardScene[];
  lockedAt?: number | null;
};

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
  sceneId?: string;
  sceneIndex?: number;
};

export type ValidationResult = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};
