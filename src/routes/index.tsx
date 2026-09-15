import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createProject, listProjects } from "@/lib/beatvision";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<
    { id: string; title: string; artist: string; updated_at: string }[]
  >([]);

  useEffect(() => {
    listProjects()
      .then(setRecent)
      .catch(() => setRecent([]));
  }, []);

  const canStart =
    draft.title.trim().length > 0 &&
    draft.artist.trim().length > 0 &&
    (audioName !== null || draft.lyrics.trim().length > 0);

  function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setAudioName(file ? file.name : null);
  }

  async function handleStart() {
    if (!canStart || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: draft.title.trim(),
        artist: draft.artist.trim(),
        lyrics: draft.lyrics,
        creativeDirection: draft.creativeDirection,
        notes: draft.notes,
        audioName,
      };
      const { id } = await createProject({ data: payload });
      // Keep session cache for fast hand-off; DB is source of truth
      sessionStorage.setItem("bv-project-id", id);
      sessionStorage.setItem(
        "bv-project-draft",
        JSON.stringify({ ...payload, audioName })
      );
      navigate({ to: "/project/new" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create project"
      );
    } finally {
      setSaving(false);
    }
  }

  function openProject(id: string) {
    sessionStorage.setItem("bv-project-id", id);
    // Clear stage caches so downstream pages load from DB
    sessionStorage.removeItem("bv-project-draft");
    sessionStorage.removeItem("bv-world-report");
    sessionStorage.removeItem("bv-world-state");
    sessionStorage.removeItem("bv-storyboard");
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
              Projects are stored in the database and survive refresh.
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
                the master timeline later. Filename is stored; bytes come in a
                later phase.
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

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="pt-2">
              <button
                type="button"
                disabled={!canStart || saving}
                onClick={handleStart}
                className="w-full sm:w-auto rounded-xl bg-[var(--bv-accent)] px-6 py-3 text-sm font-semibold text-[#0a0a0f] transition hover:bg-[var(--bv-accent-2)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Creating project…" : "Continue to Reveal World"}
              </button>
            </div>
          </div>

          {recent.length > 0 && (
            <div className="rounded-2xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-6 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--bv-text)]">
                Recent projects
              </h3>
              <p className="text-xs text-[var(--bv-muted)]">
                Auth is off — projects are unowned and listed here for this
                deployment. Open one to continue from where it left off.
              </p>
              <ul className="space-y-2">
                {recent.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => openProject(p.id)}
                      className="w-full text-left rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface-2)] px-4 py-3 hover:border-[var(--bv-accent)] transition"
                    >
                      <span className="font-medium text-[var(--bv-text)] text-sm">
                        {p.title}
                      </span>
                      <span className="text-[var(--bv-muted)] text-sm">
                        {" "}by {p.artist}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
