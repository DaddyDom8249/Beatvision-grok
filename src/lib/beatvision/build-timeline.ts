/**
 * Song master timeline builder for BeatVision.
 * Prefer real duration_sec from audio metadata.
 * Fall back to an explicit estimate only when no duration exists.
 * Never invents audio analysis beyond proportional section layout.
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
  audioName: string | null;
  /** Real duration from audio metadata when known */
  durationSec?: number | null;
};

export type TimelineBuildResult = {
  timeline: SongTimeline;
  /** true when duration came from real audio metadata */
  isRealDuration: boolean;
};

/**
 * Estimate duration only when no real duration is available.
 * Never labeled as measured audio analysis.
 */
export function estimateDurationSec(source: TimelineSource): number {
  const words = source.lyrics.trim().split(/\s+/).filter(Boolean).length;
  if (words > 0) {
    return Math.min(360, Math.max(90, Math.round(words / 2.2)));
  }
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
 * Build contiguous proportional sections for a known duration.
 */
export function buildSongTimeline(durationSec: number): SongTimeline {
  const duration = Math.max(1, durationSec);
  const sections: MusicalSection[] = [];
  let cursor = 0;

  for (let i = 0; i < STRUCTURE.length; i++) {
    const { kind, weight, label } = STRUCTURE[i];
    const isLast = i === STRUCTURE.length - 1;
    const endSec = isLast
      ? duration
      : Math.min(duration, Math.round(cursor + duration * weight));
    // Guard against zero-length from rounding
    const startSec = Math.min(cursor, duration);
    const safeEnd = Math.max(startSec + 0.01, endSec);
    sections.push({
      id: `sec-${kind}-${i}`,
      kind,
      startSec,
      endSec: Math.min(duration, safeEnd),
      label,
    });
    cursor = sections[sections.length - 1].endSec;
  }

  // Ensure last section ends exactly at duration
  if (sections.length > 0) {
    sections[sections.length - 1].endSec = duration;
  }

  return { durationSec: duration, sections };
}

/**
 * Prefer real duration from audio; otherwise estimate and mark as estimated.
 */
export function buildTimelineFromSource(
  source: TimelineSource
): TimelineBuildResult {
  const real =
    typeof source.durationSec === "number" &&
    Number.isFinite(source.durationSec) &&
    source.durationSec > 0
      ? source.durationSec
      : null;

  if (real !== null) {
    return {
      timeline: buildSongTimeline(real),
      isRealDuration: true,
    };
  }

  return {
    timeline: buildSongTimeline(estimateDurationSec(source)),
    isRealDuration: false,
  };
}

/** @deprecated Prefer buildTimelineFromSource */
export function buildEstimatedTimeline(source: TimelineSource): SongTimeline {
  return buildTimelineFromSource(source).timeline;
}
