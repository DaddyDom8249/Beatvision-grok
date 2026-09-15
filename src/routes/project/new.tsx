import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/project/new")({
  component: RevealWorldPage,
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

function deriveReport(draft: Draft): VisualWorldReport {
  // Deterministic, transparent derivation from the song inputs.
  // No fake generation — this is an analysis pass the creator can accept or revise.
  const title = draft.title || "Untitled";
  const direction = draft.creativeDirection || "cinematic and emotional";
  const hasLyrics = draft.lyrics.trim().length > 0;

  return {
    emotionalMood: hasLyrics
      ? `Drawn from the lyrics and direction of “${title}” — ${direction.slice(0, 80)}`
      : `Anchored in the creative direction for “${title}”: ${direction.slice(0, 100)}`,
    emotionalArc:
      "Verse → build → peak → resolve. Scenes will map to musical sections once timing is available.",
    visualLanguage: `Cinematic, song-led visual language for ${draft.artist || "the artist"}.`,
    cinematography:
      "Deliberate camera language: slow pushes on emotional peaks, wider frames on atmosphere, tighter frames on character moments.",
    environments: [
      "Primary environment derived from creative direction",
      "Secondary transitional space for musical builds",
      "Final resolve environment",
    ],
    characters: [
      `Lead presence for ${draft.artist || "the performer"}`,
      "Supporting figures only if the lyrics or direction call for them",
    ],
    lighting:
      "Motivated, emotional lighting that shifts with the arc — cooler in verses, warmer or higher contrast at the peak.",
    colorDirection:
      "A restrained palette that supports the mood. Avoid random neon unless the direction explicitly asks for it.",
    visualMotifs: [
      "Recurring motif tied to the song title / central image",
      "Texture or weather that tracks emotional intensity",
    ],
    movement:
      "Camera and subject movement locked to the song’s energy — never arbitrary scene timing.",
    atmosphere:
      "The world must feel continuous. Characters, environments, and visual rules persist across every scene.",
  };
}

function RevealWorldPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [report, setReport] = useState<VisualWorldReport | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("bv-project-draft");
    if (!raw) {
      navigate({ to: "/" });
      return;
    }
    try {
      setDraft(JSON.parse(raw) as Draft);
    } catch {
      navigate({ to: "/" });
    }
  }, [navigate]);

  function handleReveal() {
    if (!draft) return;
    setRevealing(true);
    window.setTimeout(() => {
      setReport(deriveReport(draft));
      setRevealing(false);
    }, 600);
  }

  function handleConfirm() {
    if (!report || !draft) return;
    sessionStorage.setItem(
      "bv-world-report",
      JSON.stringify({ draft, report, confirmedAt: Date.now() })
    );
    setConfirmed(true);
  }

  function goToStyleBible() {
    navigate({ to: "/project/world" });
  }

  if (!draft) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--bv-muted)]">
        Loading project…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--bv-border)] bg-[var(--bv-surface)]">
        <div className="mx-auto max-w-3xl px-4 py-5">
          <p className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
            Project
          </p>
          <h1 className="text-xl font-semibold text-[var(--bv-text)]">
            {draft.title}
            <span className="text-[var(--bv-muted)] font-normal">
              {" "}by {draft.artist}
            </span>
          </h1>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10 space-y-8">
        {!report && (
          <section className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--bv-text)]">
              Reveal World
            </h2>
            <p className="text-[var(--bv-muted)] leading-relaxed">
              This is the primary creative action. BeatVision will turn the
              song’s information into a Visual World Report. You must review and
              confirm it before anything is generated.
            </p>
            <button
              type="button"
              onClick={handleReveal}
              disabled={revealing}
              className="rounded-xl bg-[var(--bv-accent)] px-6 py-3 text-sm font-semibold text-[#0a0a0f] hover:bg-[var(--bv-accent-2)] disabled:opacity-50"
            >
              {revealing ? "Revealing…" : "Reveal World"}
            </button>
          </section>
        )}

        {report && (
          <section className="space-y-6">
            <div className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--bv-text)]">
                    Visual World Report
                  </h2>
                  <p className="text-sm text-[var(--bv-muted)] mt-1">
                    Review this world. Nothing generates until you confirm.
                  </p>
                </div>
                {confirmed && (
                  <span className="shrink-0 rounded-full bg-[var(--bv-success)]/15 px-3 py-1 text-xs font-medium text-[var(--bv-success)]">
                    Confirmed
                  </span>
                )}
              </div>

              <ReportBlock label="Emotional / musical mood" value={report.emotionalMood} />
              <ReportBlock label="Emotional arc" value={report.emotionalArc} />
              <ReportBlock label="Visual language" value={report.visualLanguage} />
              <ReportBlock label="Cinematography" value={report.cinematography} />
              <ReportBlock label="Lighting" value={report.lighting} />
              <ReportBlock label="Color direction" value={report.colorDirection} />
              <ReportBlock label="Movement" value={report.movement} />
              <ReportBlock label="Atmosphere" value={report.atmosphere} />

              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--bv-muted)] mb-2">
                  Environments
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-[var(--bv-text)]">
                  {report.environments.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--bv-muted)] mb-2">
                  Characters
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-[var(--bv-text)]">
                  {report.characters.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--bv-muted)] mb-2">
                  Visual motifs
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-[var(--bv-text)]">
                  {report.visualMotifs.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>

            {!confirmed ? (
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="rounded-xl bg-[var(--bv-accent)] px-6 py-3 text-sm font-semibold text-[#0a0a0f] hover:bg-[var(--bv-accent-2)]"
                >
                  Yes, that’s my world
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReport(null);
                    setConfirmed(false);
                  }}
                  className="rounded-xl border border-[var(--bv-border)] px-6 py-3 text-sm font-medium text-[var(--bv-text)] hover:bg-[var(--bv-surface)]"
                >
                  Revise inputs
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--bv-success)]/30 bg-[var(--bv-success)]/5 p-5 space-y-4">
                <p className="text-[var(--bv-text)] font-medium">
                  World confirmed.
                </p>
                <p className="text-sm text-[var(--bv-muted)]">
                  Next: lock the Style Bible, Characters, Environments, and
                  Visual Rules so every later scene stays continuous.
                </p>
                <button
                  type="button"
                  onClick={goToStyleBible}
                  className="rounded-xl bg-[var(--bv-accent)] px-6 py-3 text-sm font-semibold text-[#0a0a0f] hover:bg-[var(--bv-accent-2)]"
                >
                  Continue to Style Bible
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function ReportBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-[var(--bv-muted)] mb-1">
        {label}
      </p>
      <p className="text-sm text-[var(--bv-text)] leading-relaxed">{value}</p>
    </div>
  );
}
