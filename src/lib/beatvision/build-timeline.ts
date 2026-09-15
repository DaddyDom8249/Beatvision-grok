/**
 * Deterministic song timeline builder for BeatVision.
 * Uses only creator inputs. Does not invent audio analysis.
 * Real duration arrives only when audio is analyzed; until then
 * the UI must label the timeline as estimated.
 */

import type {
  MusicalSection,
  MusicalSectionKind,
  SongTimeline,
} from "./types.ts";

export type TimelineSource = {
  title: string;
  artist: string;
  lyrics: string;
  creativeDirection: string;
  /** Filename only until real upload + analysis exists */
  audioName: string | null;
};

/**
 * Estimate duration in seconds from available inputs.
 * Prefer a conservative floor so scenes are not forced into tiny windows.
 * Never pretends to be real audio analysis.
 */
export function estimateDurationSec(source: TimelineSource): number {
  const words = source.lyrics.trim().split(/\s+/).filter(Boolean).length;
  // ~2.2 words per second average sung lyric density; floor at 90s, cap 360s
  if (words > 0) {
    return Math.min(360, Math.max(90, Math.round(words / 2.2)));
  }
  // No lyrics: use a neutral mid-length default
  return 150;
}

const STRUCTURE: { kind: MusicalSectionKind; weight: number; label: string }[] =
  [
    { kind: "intro", weight: 0.1, label: "Intro" },
    { kind: "verse", weight: 0.28, label: "Verse" },
    { kind: "pre_chorus", weight: 0.1, label: "Pre-chorus" },
    { kind: "chorus", weight: 0.22, label: "Chorus" },
    { kind: "bridge", weight: 0.12, label: "Bridge" },
    { kind: "outro", weight: 0.18, label: "Outro" },
  ];

/**
 * Build a deterministic SongTimeline from project draft inputs.
 * Sections are proportional and contiguous; no silent gaps.
 */
export function buildEstimatedTimeline(source: TimelineSource): SongTimeline {
  const durationSec = estimateDurationSec(source);
  const sections: MusicalSection[] = [];
  let cursor = 0;

  for (let i = 0; i < STRUCTURE.length; i++) {
    const { kind, weight, label } = STRUCTURE[i];
    const isLast = i === STRUCTURE.length - 1;
    const endSec = isLast
      ? durationSec
      : Math.round(cursor + durationSec * weight);
    sections.push({
      id: `sec-${kind}-${i}`,
      kind,
      startSec: cursor,
      endSec,
      label,
    });
    cursor = endSec;
  }

  return { durationSec, sections };
}
