import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  buildEstimatedTimeline,
  validateStoryboard,
  type CameraEnergyBand,
  type CameraMove,
  type Character,
  type Environment,
  type LockedWorld,
  type ShotScale,
  type SongTimeline,
  type Storyboard,
  type StoryboardScene,
  type StyleBible,
  type ValidationResult,
  type VisualRules,
} from "@/lib/beatvision";

export const Route = createFileRoute("/project/storyboard")({
  component: StoryboardPage,
});

type Draft = {
  title: string;
  artist: string;
  lyrics: string;
  creativeDirection: string;
  notes: string;
  audioName: string | null;
};

type WorldState = {
  draft: Draft;
  report: unknown;
  styleBible: StyleBible;
  characters: Character[];
  environments: Environment[];
  visualRules: VisualRules;
  lockedAt: number | null;
};

const SCALES: ShotScale[] = [
  "extreme_wide",
  "wide",
  "medium",
  "medium_close",
  "close",
  "extreme_close",
];

const MOVES: CameraMove[] = [
  "static",
  "slow_push",
  "slow_pull",
  "lateral_track",
  "pan",
  "tilt",
  "orbit",
];

const ENERGY: CameraEnergyBand[] = [
  "low",
  "medium",
  "rising",
  "high",
  "settled",
];

function seedScenes(
  timeline: SongTimeline,
  world: LockedWorld
): StoryboardScene[] {
  const envId = world.environments[0]?.id ?? "env-missing";
  const charIds = world.characters.slice(0, 1).map((c) => c.id);

  return timeline.sections.map((sec, i) => {
    const energy =
      sec.kind === "chorus"
        ? "high"
        : sec.kind === "pre_chorus" || sec.kind === "bridge"
          ? "rising"
          : sec.kind === "outro"
            ? "settled"
            : "low";
    const move: CameraMove =
      sec.kind === "chorus"
        ? "slow_push"
        : sec.kind === "intro" || sec.kind === "outro"
          ? "static"
          : "lateral_track";
    const scale: ShotScale =
      sec.kind === "chorus" ? "close" : sec.kind === "intro" ? "wide" : "medium";

    // Ensure min duration for move is respected by the section itself
    return {
      id: `scene-${i + 1}`,
      startSec: sec.startSec,
      endSec: sec.endSec,
      sectionId: sec.id,
      environmentId: envId,
      characterIds: charIds,
      camera: {
        scale,
        move,
        energyBand: energy,
        notes: `${sec.label ?? sec.kind} — song-led`,
      },
      summary: `${sec.label ?? sec.kind}: continue the locked world`,
      generationJobId: null,
      mediaAssetId: null,
      reuseMediaFromSceneId: null,
    };
  });
}

function StoryboardPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lockedWorld, setLockedWorld] = useState<LockedWorld | null>(null);
  const [timeline, setTimeline] = useState<SongTimeline | null>(null);
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lockedAt, setLockedAt] = useState<number | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("bv-world-state");
    if (!raw) {
      navigate({ to: "/" });
      return;
    }
    try {
      const world = JSON.parse(raw) as WorldState;
      if (!world.lockedAt) {
        navigate({ to: "/project/world" });
        return;
      }
      setDraft(world.draft);
      const lw: LockedWorld = {
        styleBible: world.styleBible,
        characters: world.characters,
        environments: world.environments,
        visualRules: world.visualRules,
        lockedAt: world.lockedAt,
      };
      setLockedWorld(lw);

      const tl = buildEstimatedTimeline({
        title: world.draft.title,
        artist: world.draft.artist,
        lyrics: world.draft.lyrics,
        creativeDirection: world.draft.creativeDirection,
        audioName: world.draft.audioName,
      });
      setTimeline(tl);

      const existing = sessionStorage.getItem("bv-storyboard");
      if (existing) {
        const parsed = JSON.parse(existing) as {
          storyboard: Storyboard;
          lockedAt: number | null;
        };
        setStoryboard(parsed.storyboard);
        setLockedAt(parsed.lockedAt);
        if (parsed.storyboard.scenes[0]) {
          setSelectedId(parsed.storyboard.scenes[0].id);
        }
      } else {
        const scenes = seedScenes(tl, lw);
        const board: Storyboard = { scenes, lockedAt: null };
        setStoryboard(board);
        setSelectedId(scenes[0]?.id ?? null);
      }
    } catch {
      navigate({ to: "/" });
    }
  }, [navigate]);

  const validation: ValidationResult | null = useMemo(() => {
    if (!timeline || !lockedWorld || !storyboard) return null;
    return validateStoryboard(timeline, lockedWorld, storyboard);
  }, [timeline, lockedWorld, storyboard]);

  const selected = storyboard?.scenes.find((s) => s.id === selectedId) ?? null;

  function updateScene(id: string, patch: Partial<StoryboardScene>) {
    setStoryboard((sb) => {
      if (!sb) return sb;
      return {
        ...sb,
        scenes: sb.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        lockedAt: null,
      };
    });
    setLockedAt(null);
    setSavedMsg(null);
  }

  function updateCamera(
    id: string,
    patch: Partial<StoryboardScene["camera"]>
  ) {
    setStoryboard((sb) => {
      if (!sb) return sb;
      return {
        ...sb,
        scenes: sb.scenes.map((s) =>
          s.id === id ? { ...s, camera: { ...s.camera, ...patch } } : s
        ),
        lockedAt: null,
      };
    });
    setLockedAt(null);
    setSavedMsg(null);
  }

  function addScene() {
    if (!timeline || !lockedWorld || !storyboard) return;
    const last = [...storyboard.scenes].sort(
      (a, b) => a.endSec - b.endSec
    )[storyboard.scenes.length - 1];
    const start = last ? last.endSec : 0;
    const end = Math.min(start + 8, timeline.durationSec);
    if (end <= start) return;
    const section =
      timeline.sections.find(
        (s) => start >= s.startSec && start < s.endSec
      ) ?? timeline.sections[0];
    const id = `scene-${Date.now()}`;
    const scene: StoryboardScene = {
      id,
      startSec: start,
      endSec: end,
      sectionId: section.id,
      environmentId: lockedWorld.environments[0]?.id ?? "",
      characterIds: lockedWorld.characters[0] ? [lockedWorld.characters[0].id] : [],
      camera: {
        scale: "medium",
        move: "static",
        energyBand: "medium",
      },
      summary: "New scene",
      generationJobId: null,
      mediaAssetId: null,
      reuseMediaFromSceneId: null,
    };
    setStoryboard({
      scenes: [...storyboard.scenes, scene],
      lockedAt: null,
    });
    setSelectedId(id);
    setLockedAt(null);
    setSavedMsg(null);
  }

  function removeScene(id: string) {
    if (!storyboard || storyboard.scenes.length <= 1) return;
    const next = storyboard.scenes.filter((s) => s.id !== id);
    setStoryboard({ scenes: next, lockedAt: null });
    setSelectedId(next[0]?.id ?? null);
    setLockedAt(null);
    setSavedMsg(null);
  }

  function saveAndLock() {
    if (!storyboard || !validation?.ok) return;
    const locked: Storyboard = { ...storyboard, lockedAt: Date.now() };
    sessionStorage.setItem(
      "bv-storyboard",
      JSON.stringify({ storyboard: locked, lockedAt: locked.lockedAt })
    );
    setStoryboard(locked);
    setLockedAt(locked.lockedAt ?? null);
    setSavedMsg("Storyboard locked. Ready for scene generation (next phase).");
  }

  function saveDraft() {
    if (!storyboard) return;
    sessionStorage.setItem(
      "bv-storyboard",
      JSON.stringify({ storyboard, lockedAt: null })
    );
    setSavedMsg("Draft saved.");
  }

  if (!draft || !lockedWorld || !timeline || !storyboard) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--bv-muted)]">
        Loading storyboard…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--bv-border)] bg-[var(--bv-surface)]">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
              Storyboard · song master timeline
            </p>
            <h1 className="text-xl font-semibold text-[var(--bv-text)]">
              {draft.title}
              <span className="text-[var(--bv-muted)] font-normal">
                {" "}by {draft.artist}
              </span>
            </h1>
          </div>
          {lockedAt && (
            <span className="shrink-0 rounded-full bg-[var(--bv-success)]/15 px-3 py-1 text-xs font-medium text-[var(--bv-success)]">
              Locked
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 space-y-8">
        {/* Honest timeline notice */}
        <div className="rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-4 text-sm text-[var(--bv-muted)] leading-relaxed">
          <strong className="text-[var(--bv-text)]">Estimated timeline</strong>
          {" — "}
          {timeline.durationSec}s total
          {draft.audioName
            ? ` (filename: ${draft.audioName}). Real duration requires audio analysis; this structure is proportional and deterministic until then.`
            : ". No audio on file yet; duration estimated from lyrics length (or default). Real timing arrives with audio analysis."}
          {" "}No media is generated in this phase. Scenes are planning only.
        </div>

        {/* Section overview */}
        <section className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--bv-text)]">
            Musical sections
          </h2>
          <div className="flex flex-wrap gap-2">
            {timeline.sections.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2 text-xs"
              >
                <span className="font-medium text-[var(--bv-text)]">
                  {s.label ?? s.kind}
                </span>
                <span className="text-[var(--bv-muted)] ml-2">
                  {s.startSec}s–{s.endSec}s
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Scene list + editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--bv-text)]">
                Scenes ({storyboard.scenes.length})
              </h2>
              <button
                type="button"
                onClick={addScene}
                className="rounded-lg border border-[var(--bv-border)] px-3 py-1.5 text-sm text-[var(--bv-text)] hover:bg-[var(--bv-surface)]"
              >
                Add scene
              </button>
            </div>

            <ul className="space-y-2">
              {[...storyboard.scenes]
                .sort((a, b) => a.startSec - b.startSec)
                .map((s) => {
                  const sec = timeline.sections.find((x) => x.id === s.sectionId);
                  const isSel = s.id === selectedId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                          isSel
                            ? "border-[var(--bv-accent)] bg-[var(--bv-surface)]"
                            : "border-[var(--bv-border)] bg-[var(--bv-surface-2)] hover:border-[var(--bv-muted)]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-[var(--bv-text)] text-sm">
                            {s.summary || s.id}
                          </span>
                          <span className="text-xs text-[var(--bv-muted)]">
                            {s.startSec}s–{s.endSec}s
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--bv-muted)]">
                          {sec?.label ?? s.sectionId} · {s.camera.scale} ·{" "}
                          {s.camera.move} · {s.camera.energyBand}
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>

            {selected && (
              <div className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--bv-text)]">
                    Edit scene
                  </h3>
                  <button
                    type="button"
                    onClick={() => removeScene(selected.id)}
                    disabled={storyboard.scenes.length <= 1}
                    className="text-xs text-[var(--bv-muted)] hover:text-red-400 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>

                <Field
                  label="Summary"
                  value={selected.summary ?? ""}
                  onChange={(v) => updateScene(selected.id, { summary: v })}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Start (s)"
                    value={String(selected.startSec)}
                    onChange={(v) => {
                      const n = Number(v);
                      if (!Number.isNaN(n))
                        updateScene(selected.id, { startSec: n });
                    }}
                  />
                  <Field
                    label="End (s)"
                    value={String(selected.endSec)}
                    onChange={(v) => {
                      const n = Number(v);
                      if (!Number.isNaN(n))
                        updateScene(selected.id, { endSec: n });
                    }}
                  />
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
                    Section
                  </span>
                  <select
                    value={selected.sectionId}
                    onChange={(e) =>
                      updateScene(selected.id, { sectionId: e.target.value })
                    }
                    className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-sm text-[var(--bv-text)]"
                  >
                    {timeline.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label ?? s.kind} ({s.startSec}–{s.endSec}s)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
                    Environment
                  </span>
                  <select
                    value={selected.environmentId}
                    onChange={(e) =>
                      updateScene(selected.id, {
                        environmentId: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-sm text-[var(--bv-text)]"
                  >
                    {lockedWorld.environments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
                    Characters (hold Ctrl/Cmd for multi)
                  </span>
                  <select
                    multiple
                    value={selected.characterIds}
                    onChange={(e) => {
                      const ids = Array.from(e.target.selectedOptions).map(
                        (o) => o.value
                      );
                      updateScene(selected.id, { characterIds: ids });
                    }}
                    className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-sm text-[var(--bv-text)] min-h-[80px]"
                  >
                    {lockedWorld.characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.role}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
                      Scale
                    </span>
                    <select
                      value={selected.camera.scale}
                      onChange={(e) =>
                        updateCamera(selected.id, {
                          scale: e.target.value as ShotScale,
                        })
                      }
                      className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-2 py-2 text-sm text-[var(--bv-text)]"
                    >
                      {SCALES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
                      Move
                    </span>
                    <select
                      value={selected.camera.move}
                      onChange={(e) =>
                        updateCamera(selected.id, {
                          move: e.target.value as CameraMove,
                        })
                      }
                      className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-2 py-2 text-sm text-[var(--bv-text)]"
                    >
                      {MOVES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
                      Energy
                    </span>
                    <select
                      value={selected.camera.energyBand}
                      onChange={(e) =>
                        updateCamera(selected.id, {
                          energyBand: e.target.value as CameraEnergyBand,
                        })
                      }
                      className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-2 py-2 text-sm text-[var(--bv-text)]"
                    >
                      {ENERGY.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <Field
                  label="Camera notes"
                  value={selected.camera.notes ?? ""}
                  onChange={(v) => updateCamera(selected.id, { notes: v })}
                />
              </div>
            )}
          </div>

          {/* Validation panel */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-5 space-y-3 sticky top-4">
              <h2 className="text-sm font-semibold text-[var(--bv-text)]">
                Validation
              </h2>
              {validation?.ok ? (
                <p className="text-sm text-[var(--bv-success)]">
                  Storyboard is valid against the locked world and estimated
                  timeline.
                </p>
              ) : (
                <p className="text-sm text-amber-400">
                  Fix errors before locking.
                </p>
              )}

              {validation && validation.errors.length > 0 && (
                <ul className="space-y-2">
                  {validation.errors.map((e, i) => (
                    <li
                      key={`${e.code}-${i}`}
                      className="text-xs text-red-400 leading-snug"
                    >
                      <span className="font-mono">{e.code}</span>: {e.message}
                    </li>
                  ))}
                </ul>
              )}

              {validation && validation.warnings.length > 0 && (
                <ul className="space-y-2">
                  {validation.warnings.map((w, i) => (
                    <li
                      key={`${w.code}-${i}`}
                      className="text-xs text-amber-400/90 leading-snug"
                    >
                      <span className="font-mono">{w.code}</span>: {w.message}
                    </li>
                  ))}
                </ul>
              )}

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={saveDraft}
                  className="w-full rounded-xl border border-[var(--bv-border)] px-4 py-2.5 text-sm font-medium text-[var(--bv-text)] hover:bg-[var(--bv-surface-2)]"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={saveAndLock}
                  disabled={!validation?.ok}
                  className="w-full rounded-xl bg-[var(--bv-accent)] px-4 py-2.5 text-sm font-semibold text-[#0a0a0f] hover:bg-[var(--bv-accent-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lock storyboard
                </button>
                {savedMsg && (
                  <p className="text-xs text-[var(--bv-success)]">{savedMsg}</p>
                )}
              </div>

              <p className="text-[11px] text-[var(--bv-muted)] leading-relaxed pt-2 border-t border-[var(--bv-border)]">
                No generation runs here. Media, motion, and final video are later
                phases. Validation prevents silent media recycling and
                timeline/world mismatches.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-sm text-[var(--bv-text)] focus:outline-none focus:ring-2 focus:ring-[var(--bv-accent)]"
      />
    </label>
  );
}
