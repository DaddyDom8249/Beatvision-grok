import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  createGenerationJob,
  getProject,
  getProviderStatus,
  listGenerationJobs,
  listMediaAssets,
  type GenerationJobRow,
  type MediaAssetRow,
  type ProviderAvailability,
  type Storyboard,
  type StoryboardScene,
} from "@/lib/beatvision";

export const Route = createFileRoute("/project/generate")({
  component: GeneratePage,
});

function briefForScene(scene: StoryboardScene): string {
  const chars = scene.characterIds.join(", ") || "none";
  return [
    scene.summary ?? scene.id,
    `time ${scene.startSec.toFixed(1)}s–${scene.endSec.toFixed(1)}s`,
    `env ${scene.environmentId}`,
    `characters ${chars}`,
    `camera ${scene.camera.scale} / ${scene.camera.move} / ${scene.camera.energyBand}`,
    scene.camera.notes ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function GeneratePage() {
  const navigate = useNavigate();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [jobs, setJobs] = useState<GenerationJobRow[]>([]);
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [statuses, setStatuses] = useState<ProviderAvailability[]>([]);
  const [busyScene, setBusyScene] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshJobs = useCallback(async (id: string) => {
    try {
      const [j, a] = await Promise.all([
        listGenerationJobs({ data: { projectId: id } }),
        listMediaAssets({ data: { projectId: id } }),
      ]);
      setJobs(j);
      setAssets(a);
    } catch {
      /* keep prior */
    }
  }, []);

  useEffect(() => {
    const id = sessionStorage.getItem("bv-project-id");
    if (!id) {
      navigate({ to: "/" });
      return;
    }
    setProjectId(id);

    async function boot() {
      try {
        const [row, providerStatuses] = await Promise.all([
          getProject({ data: { id: id! } }),
          getProviderStatus(),
        ]);
        setStatuses(providerStatuses);

        if (!row) {
          navigate({ to: "/" });
          return;
        }
        setTitle(row.title);
        setArtist(row.artist);

        const sbRaw = row.storyboard as
          | { storyboard: Storyboard; lockedAt: number | null }
          | null;
        const locked =
          (sbRaw as { storyboard?: Storyboard })?.storyboard?.lockedAt ??
          (sbRaw as { lockedAt?: number | null })?.lockedAt;
        if (!locked) {
          setError(
            "Storyboard is not locked yet. Lock it before generating media."
          );
          setScenes([]);
          return;
        }

        const board =
          (sbRaw as { storyboard: Storyboard })?.storyboard ??
          (sbRaw as unknown as Storyboard);
        if (!board?.scenes?.length) {
          setError("No scenes on the locked storyboard.");
          return;
        }
        setScenes(board.scenes);
        await refreshJobs(id!);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load project"
        );
      }
    }

    void boot();
  }, [navigate, refreshJobs]);

  async function requestScene(scene: StoryboardScene) {
    if (!projectId || busyScene) return;
    setBusyScene(scene.id);
    setMessage(null);
    setError(null);
    try {
      const result = await createGenerationJob({
        data: {
          projectId,
          sceneId: scene.id,
          brief: briefForScene(scene),
          startSec: scene.startSec,
          endSec: scene.endSec,
          capability: "still_image",
        },
      });

      if (result.status === "unavailable") {
        setMessage(
          `Provider unavailable: ${result.errorMessage ?? result.errorCode}`
        );
      } else if (result.status === "failed") {
        setMessage(
          `Generation failed: ${result.errorMessage ?? result.errorCode}`
        );
      } else if (result.status === "succeeded") {
        const url =
          "mediaUrl" in result && typeof result.mediaUrl === "string"
            ? result.mediaUrl
            : null;
        setMessage(
          url
            ? `Scene ${scene.id} generated. Media URL recorded (provider-hosted).`
            : `Scene ${scene.id} generated (asset ${result.mediaAssetId}).`
        );
      } else {
        setMessage(`Job ${result.jobId} status: ${result.status}`);
      }

      await refreshJobs(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation request failed");
    } finally {
      setBusyScene(null);
    }
  }

  const anyAvailable = statuses.some((s) => s.available);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--bv-border)] bg-[var(--bv-surface)]">
        <div className="mx-auto max-w-4xl px-4 py-5">
          <p className="text-xs uppercase tracking-wider text-[var(--bv-muted)]">
            Generation · BeatVision Arena
          </p>
          <h1 className="text-xl font-semibold text-[var(--bv-text)]">
            {title || "Project"}
            {artist ? (
              <span className="text-[var(--bv-muted)] font-normal">
                {" "}by {artist}
              </span>
            ) : null}
          </h1>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 space-y-8">
        <div className="rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-4 text-sm text-[var(--bv-muted)] leading-relaxed">
          <strong className="text-[var(--bv-text)]">Provider status</strong>
          {" — "}
          {anyAvailable
            ? "Arena is available for still-image generation."
            : "Arena is not ready. Jobs will be recorded as unavailable or failed — no fake media."}
          <ul className="mt-3 space-y-1">
            {statuses.map((s) => (
              <li key={s.provider} className="text-xs">
                <span className="font-mono text-[var(--bv-text)]">
                  {s.provider}
                </span>
                {": "}
                {s.available
                  ? `available (${s.capabilities.join(", ")})`
                  : `${s.code} — ${s.reason}`}
              </li>
            ))}
            {statuses.length === 0 && (
              <li className="text-xs">Loading provider status…</li>
            )}
          </ul>
          <p className="text-[11px] mt-2">
            Requires server env BEATVISION_ARENA_URL and BEATVISION_ARENA_TOKEN.
            Tokens never leave the server.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-amber-300">{message}</p>}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--bv-text)]">Scenes</h2>
          {scenes.length === 0 ? (
            <p className="text-sm text-[var(--bv-muted)]">
              Lock a storyboard first, then return here.
            </p>
          ) : (
            <ul className="space-y-2">
              {scenes
                .slice()
                .sort((a, b) => a.startSec - b.startSec)
                .map((s) => {
                  const sceneJobs = jobs.filter((j) => j.scene_id === s.id);
                  const sceneAssets = assets.filter((a) => a.scene_id === s.id);
                  const latest = sceneJobs[0];
                  const latestAsset = sceneAssets[0];
                  return (
                    <li
                      key={s.id}
                      className="rounded-xl border border-[var(--bv-border)] bg-[var(--bv-surface)] p-4 flex flex-col sm:flex-row sm:items-start gap-3 justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[var(--bv-text)] text-sm truncate">
                          {s.summary || s.id}
                        </p>
                        <p className="text-xs text-[var(--bv-muted)] mt-0.5">
                          {s.startSec.toFixed(1)}s–{s.endSec.toFixed(1)}s ·{" "}
                          {s.camera.scale} / {s.camera.move}
                        </p>
                        {latest && (
                          <p className="text-xs mt-1">
                            <span className="text-[var(--bv-muted)]">Latest job: </span>
                            <span
                              className={
                                latest.status === "succeeded"
                                  ? "text-[var(--bv-success)]"
                                  : latest.status === "unavailable" ||
                                      latest.status === "failed"
                                    ? "text-amber-400"
                                    : "text-[var(--bv-text)]"
                              }
                            >
                              {latest.status}
                            </span>
                            {latest.error_message
                              ? ` — ${latest.error_message}`
                              : ""}
                          </p>
                        )}
                        {latestAsset?.url && (
                          <div className="mt-2 space-y-1">
                            <a
                              href={latestAsset.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[var(--bv-accent)] break-all underline"
                            >
                              Open media URL
                            </a>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={latestAsset.url}
                              alt={`Generated still for ${s.id}`}
                              className="mt-1 max-h-40 rounded-lg border border-[var(--bv-border)] object-cover"
                            />
                            <p className="text-[10px] text-[var(--bv-muted)]">
                              Provider-hosted URL — not claimed as permanent Grok storage.
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busyScene !== null}
                        onClick={() => requestScene(s)}
                        className="shrink-0 rounded-xl bg-[var(--bv-accent)] px-4 py-2 text-sm font-semibold text-[#0a0a0f] hover:bg-[var(--bv-accent-2)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {busyScene === s.id ? "Requesting…" : "Request still"}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        {jobs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--bv-text)]">Job log</h2>
            <ul className="space-y-1 text-xs text-[var(--bv-muted)] font-mono">
              {jobs.slice(0, 20).map((j) => (
                <li key={j.id}>
                  {j.created_at} · {j.scene_id} · {j.provider} · {j.status}
                  {j.error_code ? ` · ${j.error_code}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/project/storyboard" })}
            className="text-sm text-[var(--bv-muted)] hover:text-[var(--bv-text)]"
          >
            ← Back to storyboard
          </button>
        </div>
      </main>
    </div>
  );
}
