import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

type ProjectDraft = {
  title: string;
  artist: string;
  lyrics: string;
  creativeDirection: string;
  notes: string;
};

function Home() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ProjectDraft>({
    title: "",
    artist: "",
    lyrics: "",
    creativeDirection: "",
    notes: "",
  });
  const [audioName, setAudioName] = useState<string | null>(null);

  const canStart =
    draft.title.trim().length > 0 &&
    draft.artist.trim().length > 0 &&
    (audioName !== null || draft.lyrics.trim().length > 0);

  function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setAudioName(file ? file.name : null);
  }

  function handleStart() {
    if (!canStart) return;
    // Persist draft for the next step (client-side for Phase 1)
    sessionStorage.setItem(
      "bv-project-draft",
      JSON.stringify({ ...draft, audioName })
    );
    navigate({ to: "/project/new" });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--bv-border)] bg-[var(--bv-surface)]">
        <div className="mx-auto max-w-3xl px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--bv-text)]">
              BeatVision
            </h1>
            <p className="text-sm text-[var(--bv-muted)] mt-0.5">
              Every Song Has a World. BeatVision Reveals It.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10">
        <section className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--bv-text)]">
              Start with a song
            </h2>
            <p className="mt-2 text-[var(--bv-muted)] leading-relaxed">
              The song is the master creative and timeline source. Upload the
              audio, add lyrics and direction, then reveal its visual world.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--bv-text)]">
                  Song title <span className="text-[var(--bv-accent)]">*</span>
                </span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  placeholder="e.g. Midnight Drive"
                  className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-[var(--bv-text)] placeholder:text-[var(--bv-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--bv-accent)]"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-[var(--bv-text)]">
                  Artist <span className="text-[var(--bv-accent)]">*</span>
                </span>
                <input
                  type="text"
                  value={draft.artist}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, artist: e.target.value }))
                  }
                  placeholder="e.g. Nova Lane"
                  className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-[var(--bv-text)] placeholder:text-[var(--bv-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--bv-accent)]"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--bv-text)]">
                Audio file
              </span>
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-4 py-2.5 text-sm text-[var(--bv-text)] hover:bg-[var(--bv-border)] transition">
                  <span>Choose file</span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleAudioChange}
                  />
                </label>
                <span className="text-sm text-[var(--bv-muted)]">
                  {audioName ?? "No file selected"}
                </span>
              </div>
              <p className="text-xs text-[var(--bv-muted)]">
                Optional for now — lyrics alone can start a world. Audio becomes
                the master timeline later.
              </p>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--bv-text)]">
                Lyrics
              </span>
              <textarea
                value={draft.lyrics}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, lyrics: e.target.value }))
                }
                rows={5}
                placeholder="Paste lyrics here…"
                className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-[var(--bv-text)] placeholder:text-[var(--bv-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--bv-accent)] resize-y"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--bv-text)]">
                Creative direction
              </span>
              <textarea
                value={draft.creativeDirection}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    creativeDirection: e.target.value,
                  }))
                }
                rows={3}
                placeholder="Mood, era, references, what the video should feel like…"
                className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-[var(--bv-text)] placeholder:text-[var(--bv-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--bv-accent)] resize-y"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-[var(--bv-text)]">
                Notes (optional)
              </span>
              <textarea
                value={draft.notes}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, notes: e.target.value }))
                }
                rows={2}
                placeholder="Anything else the world should know…"
                className="w-full rounded-lg border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-3 py-2.5 text-[var(--bv-text)] placeholder:text-[var(--bv-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--bv-accent)] resize-y"
              />
            </label>

            <div className="pt-2">
              <button
                type="button"
                disabled={!canStart}
                onClick={handleStart}
                className="w-full sm:w-auto rounded-xl bg-[var(--bv-accent)] px-6 py-3 text-sm font-semibold text-[#0a0a0f] transition hover:bg-[var(--bv-accent-2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue to Reveal World
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
