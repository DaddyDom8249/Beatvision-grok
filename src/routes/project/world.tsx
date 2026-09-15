import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/project/world")({
  component: WorldStudioPage,
});

type Draft = {
  title: string;
  artist: string;
  lyrics: string;
  creativeDirection: string;
  notes: string;
  audioName: string | null;
};

type VisualWorldReport = {
  emotionalMood: string;
  emotionalArc: string;
  visualLanguage: string;
  cinematography: string;
  environments: string[];
  characters: string[];
  lighting: string;
  colorDirection: string;
  visualMotifs: string[];
  movement: string;
  atmosphere: string;
};

type StyleBible = {
  overallLook: string;
  colorPalette: string;
  lightingRules: string;
  cameraLanguage: string;
  textureAndGrain: string;
  doNot: string;
};

type Character = {
  id: string;
  name: string;
  role: string;
  description: string;
  continuityNotes: string;
};

type Environment = {
  id: string;
  name: string;
  description: string;
  whenUsed: string;
};

type VisualRules = {
  continuity: string;
  camera: string;
  lighting: string;
  forbidden: string;
};

type WorldState = {
  draft: Draft;
  report: VisualWorldReport;
  styleBible: StyleBible;
  characters: Character[];
  environments: Environment[];
  visualRules: VisualRules;
  lockedAt: number | null;
};

function seedFromReport(report: VisualWorldReport, draft: Draft): Omit<WorldState, "draft" | "report" | "lockedAt"> {
  return {
    styleBible: {
      overallLook: report.visualLanguage,
      colorPalette: report.colorDirection,
      lightingRules: report.lighting,
      cameraLanguage: report.cinematography,
      textureAndGrain: report.atmosphere,
      doNot:
        "Do not invent new characters or locations mid-storyboard. Do not break the emotional arc. Do not use arbitrary scene timing unrelated to the song.",
    },
    characters: report.characters.map((c, i) => ({
      id: `char-${i + 1}`,
      name: i === 0 ? draft.artist || "Lead" : `Supporting ${i}`,
      role: c,
      description: c,
      continuityNotes:
        "Appearance, wardrobe, and presence must remain consistent across every scene unless the story explicitly changes them.",
    })),
    environments: report.environments.map((e, i) => ({
      id: `env-${i + 1}`,
      name: e.split(" ")[0] + (i === 0 ? " world" : ` space ${i + 1}`),
      description: e,
      whenUsed:
        i === 0
          ? "Primary setting — verses and emotional core"
          : i === 1
            ? "Build / transition sections"
            : "Peak and resolve",
    })),
    visualRules: {
      continuity:
        "Characters, environments, color, and lighting rules persist. Later stages must not reinterpret the world independently.",
      camera: report.movement,
      lighting: report.lighting,
      forbidden:
        "No recycled unrelated media. No placeholder assets presented as final. No silent provider substitution.",
    },
  };
}

function WorldStudioPage() {
  const navigate = useNavigate();
  const [world, setWorld] = useState<WorldState | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("bv-world-report");
    if (!raw) {
      navigate({ to: "/" });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        draft: Draft;
        report: VisualWorldReport;
        confirmedAt: number;
      };
      const existing = sessionStorage.getItem("bv-world-state");
      if (existing) {
        setWorld(JSON.parse(existing) as WorldState);
      } else {
        const seeded = seedFromReport(parsed.report, parsed.draft);
        setWorld({
          draft: parsed.draft,
          report: parsed.report,
          ...seeded,
          lockedAt: null,
        });
      }
    } catch {
      navigate({ to: "/" });
    }
  }, [navigate]);

  function updateStyleBible(patch: Partial<StyleBible>) {
    setWorld((w) =>
      w ? { ...w, styleBible: { ...w.styleBible, ...patch }, lockedAt: null } : w
    );
    setSaved(false);
  }

  function updateCharacter(id: string, patch: Partial<Character>) {
    setWorld((w) =>
      w
        ? {
            ...w,
            characters: w.characters.map((c) =>
              c.id === id ? { ...c, ...patch } : c
            ),
            lockedAt: null,
          }
        : w
    );
    setSaved(false);
  }

  function updateEnvironment(id: string, patch: Partial<Environment>) {
    setWorld((w) =>
      w
        ? {
            ...w,
            environments: w.environments.map((e) =>
              e.id === id ? { ...e, ...patch } : e
            ),
            lockedAt: null,
          }
        : w
    );
    setSaved(false);
  }

  function updateVisualRules(patch: Partial<VisualRules>) {
    setWorld((w) =>
      w
        ? { ...w, visualRules: { ...w.visualRules, ...patch }, lockedAt: null }
        : w
    );
    setSaved(false);
  }

  function lockWorld() {
    if (!world) return;
    const locked: WorldState = { ...world, lockedAt: Date.now() };
    sessionStorage.setItem("bv-world-state", JSON.stringify(locked));
    setWorld(locked);
    setSaved(true);
  }

  function goToStoryboard() {
    if (!world?.lockedAt) return;
    navigate({ to: "/project/storyboard" });
  }

  if (!world) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--bv-muted)]">
        Loading world…
      </div>
    );
  }

  const { draft, styleBible, characters, environments, visualRules, lockedAt } =
    world;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--bv-border)] bg-[var(--bv-surface)]">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
              World continuity
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

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10 space-y-10">
        <p className="text-[var(--bv-muted)] leading-relaxed">
          Style Bible, Characters, Environments, and Visual Rules persist for
          every later stage. Do not reinterpret the world scene-by-scene.
        </p>

        {/* Style Bible */}
        <section className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--bv-text)]">
            Style Bible
          </h2>
          <Field
            label="Overall look"
            value={styleBible.overallLook}
            onChange={(v) => updateStyleBible({ overallLook: v })}
          />
          <Field
            label="Color palette"
            value={styleBible.colorPalette}
            onChange={(v) => updateStyleBible({ colorPalette: v })}
          />
          <Field
            label="Lighting rules"
            value={styleBible.lightingRules}
            onChange={(v) => updateStyleBible({ lightingRules: v })}
          />
          <Field
            label="Camera language"
            value={styleBible.cameraLanguage}
            onChange={(v) => updateStyleBible({ cameraLanguage: v })}
          />
          <Field
            label="Texture & grain"
            value={styleBible.textureAndGrain}
            onChange={(v) => updateStyleBible({ textureAndGrain: v })}
          />
          <Field
            label="Do not"
            value={styleBible.doNot}
            onChange={(v) => updateStyleBible({ doNot: v })}
            rows={3}
          />
        </section>

        {/* Characters */}
        <section className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-6 space-y-5">
          <h2 className="text-lg font-semibold text-[var(--bv-text)]">
            Characters
          </h2>
          {characters.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface-2)] p-4 space-y-3"
            >
              <Field
                label="Name"
                value={c.name}
                onChange={(v) => updateCharacter(c.id, { name: v })}
              />
              <Field
                label="Role"
                value={c.role}
                onChange={(v) => updateCharacter(c.id, { role: v })}
              />
              <Field
                label="Description"
                value={c.description}
                onChange={(v) => updateCharacter(c.id, { description: v })}
                rows={2}
              />
              <Field
                label="Continuity notes"
                value={c.continuityNotes}
                onChange={(v) =>
                  updateCharacter(c.id, { continuityNotes: v })
                }
                rows={2}
              />
            </div>
          ))}
        </section>

        {/* Environments */}
        <section className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-6 space-y-5">
          <h2 className="text-lg font-semibold text-[var(--bv-text)]">
            Environments
          </h2>
          {environments.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface-2)] p-4 space-y-3"
            >
              <Field
                label="Name"
                value={e.name}
                onChange={(v) => updateEnvironment(e.id, { name: v })}
              />
              <Field
                label="Description"
                value={e.description}
                onChange={(v) => updateEnvironment(e.id, { description: v })}
                rows={2}
              />
              <Field
                label="When used (musical mapping)"
                value={e.whenUsed}
                onChange={(v) => updateEnvironment(e.id, { whenUsed: v })}
              />
            </div>
          ))}
        </section>

        {/* Visual Rules */}
        <section className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-6 space-y-4">
          <h2 className="text-lg font-semibold text-[var(--bv-text)]">
            Visual Rules
          </h2>
          <Field
            label="Continuity"
            value={visualRules.continuity}
            onChange={(v) => updateVisualRules({ continuity: v })}
            rows={2}
          />
          <Field
            label="Camera"
            value={visualRules.camera}
            onChange={(v) => updateVisualRules({ camera: v })}
          />
          <Field
            label="Lighting"
            value={visualRules.lighting}
            onChange={(v) => updateVisualRules({ lighting: v })}
          />
          <Field
            label="Forbidden"
            value={visualRules.forbidden}
            onChange={(v) => updateVisualRules({ forbidden: v })}
            rows={2}
          />
        </section>

        <div className="flex flex-wrap items-center gap-3 pb-10">
          <button
            type="button"
            onClick={lockWorld}
            className="rounded-xl bg-[var(--bv-accent)] px-6 py-3 text-sm font-semibold text-[#0a0a0f] hover:bg-[var(--bv-accent-2)]"
          >
            {lockedAt ? "Update locked world" : "Lock world for storyboard"}
          </button>
          {lockedAt && (
            <button
              type="button"
              onClick={goToStoryboard}
              className="rounded-xl border border-[var(--bv-accent)] px-6 py-3 text-sm font-semibold text-[var(--bv-accent)] hover:bg-[var(--bv-accent)]/10"
            >
              Continue to Storyboard
            </button>
          )}
          {saved && (
            <span className="text-sm text-[var(--bv-success)]">
              World state saved. Ready for storyboard phase.
            </span>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const className =
    "w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-sm text-[var(--bv-text)] focus:outline-none focus:ring-2 focus:ring-[var(--bv-accent)]";
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
        {label}
      </span>
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={className + " resize-y"}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      )}
    </label>
  );
}
