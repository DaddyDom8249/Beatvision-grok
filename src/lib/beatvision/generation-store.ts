/**
 * Durable generation jobs + media assets.
 * Provider path: resolveProvider → Arena (or null) → persist truthfully.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  resolveProvider,
  type GenerationWorldContext,
  type ProviderCapability,
} from "./providers/index.ts";
import type { Character, Environment, Storyboard, StoryboardScene } from "./types.ts";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "unavailable";

export type GenerationJobRow = {
  id: string;
  project_id: string;
  scene_id: string;
  provider: string;
  status: JobStatus;
  error_code: string | null;
  error_message: string | null;
  request_json: unknown;
  result_json: unknown;
  media_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MediaAssetRow = {
  id: string;
  project_id: string;
  scene_id: string;
  job_id: string;
  provider: string;
  kind: string;
  url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  meta_json: unknown;
  created_at: string;
};

function newId(): string {
  return crypto.randomUUID();
}

type WorldStateBlob = {
  draft?: {
    title?: string;
    artist?: string;
    lyrics?: string;
    creativeDirection?: string;
  };
  report?: unknown;
  styleBible?: GenerationWorldContext["world"]["styleBible"];
  characters?: Character[];
  environments?: Environment[];
  visualRules?: GenerationWorldContext["world"]["visualRules"];
  lockedAt?: number | null;
};

function parseStoryboard(raw: unknown): Storyboard | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { storyboard?: Storyboard; scenes?: StoryboardScene[] };
  if (o.storyboard?.scenes) return o.storyboard;
  if (Array.isArray(o.scenes)) return o as Storyboard;
  return null;
}

function buildContextFromProject(row: {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
  creative_direction: string;
  duration_sec: number | null;
  world_state: unknown;
  storyboard: unknown;
}, sceneId: string): GenerationWorldContext | null {
  const board = parseStoryboard(row.storyboard);
  if (!board?.scenes?.length) return null;
  const scenes = [...board.scenes].sort((a, b) => a.startSec - b.startSec);
  const idx = scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return null;
  const scene = scenes[idx];
  const world = (row.world_state || {}) as WorldStateBlob;
  const characters = world.characters ?? [];
  const environments = world.environments ?? [];

  return {
    title: row.title,
    artist: row.artist,
    lyrics: row.lyrics,
    creativeDirection: row.creative_direction,
    durationSec: row.duration_sec,
    scene: {
      id: scene.id,
      startSec: scene.startSec,
      endSec: scene.endSec,
      sectionId: scene.sectionId,
      environmentId: scene.environmentId,
      environmentName: environments.find((e) => e.id === scene.environmentId)?.name,
      environmentDescription: environments.find((e) => e.id === scene.environmentId)
        ?.description,
      characterIds: scene.characterIds,
      characters: characters.filter((c) => scene.characterIds.includes(c.id)),
      camera: scene.camera,
      summary: scene.summary,
      previousSceneId: idx > 0 ? scenes[idx - 1].id : null,
      nextSceneId: idx + 1 < scenes.length ? scenes[idx + 1].id : null,
      sceneNumber: idx + 1,
      totalScenes: scenes.length,
    },
    world: {
      report: world.report,
      styleBible: world.styleBible,
      characters,
      environments,
      visualRules: world.visualRules,
      lockedAt: world.lockedAt ?? board.lockedAt ?? null,
    },
  };
}

const CreateJobSchema = z.object({
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  brief: z.string().min(1),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  capability: z.enum(["still_image", "video_clip", "motion"]),
});

export const createGenerationJob = createServerFn({ method: "POST" })
  .validator(CreateJobSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = newId();
    const capability = data.capability as ProviderCapability;
    const { provider, availability } = resolveProvider(capability);

    const rows = await sql<{
      id: string;
      title: string;
      artist: string;
      lyrics: string;
      creative_direction: string;
      duration_sec: number | null;
      world_state: unknown;
      storyboard: unknown;
    }>`
      select id, title, artist, lyrics, creative_direction, duration_sec,
             world_state, storyboard
      from bv_projects
      where id = ${data.projectId}
      limit 1
    `;
    const project = rows[0];
    if (!project) {
      await sql`
        insert into bv_generation_jobs (
          id, project_id, scene_id, provider, status,
          error_code, error_message, request_json
        ) values (
          ${id}, ${data.projectId}, ${data.sceneId}, ${provider.id},
          ${"failed"}, ${"invalid_request"}, ${"Project not found."},
          ${JSON.stringify(data)}::jsonb
        )
      `;
      return {
        jobId: id,
        status: "failed" as const,
        provider: provider.id,
        errorCode: "invalid_request",
        errorMessage: "Project not found.",
        mediaAssetId: null as string | null,
      };
    }

    const context = buildContextFromProject(project, data.sceneId);
    const requestJson = {
      projectId: data.projectId,
      sceneId: data.sceneId,
      brief: data.brief,
      startSec: data.startSec,
      endSec: data.endSec,
      capability,
      hasContext: Boolean(context),
    };

    if (!availability.available) {
      await sql`
        insert into bv_generation_jobs (
          id, project_id, scene_id, provider, status,
          error_code, error_message, request_json
        ) values (
          ${id},
          ${data.projectId},
          ${data.sceneId},
          ${provider.id},
          ${"unavailable"},
          ${availability.code},
          ${availability.reason},
          ${JSON.stringify(requestJson)}::jsonb
        )
      `;
      return {
        jobId: id,
        status: "unavailable" as const,
        provider: provider.id,
        errorCode: availability.code,
        errorMessage: availability.reason,
        mediaAssetId: null as string | null,
      };
    }

    await sql`
      insert into bv_generation_jobs (
        id, project_id, scene_id, provider, status, request_json
      ) values (
        ${id},
        ${data.projectId},
        ${data.sceneId},
        ${provider.id},
        ${"running"},
        ${JSON.stringify(requestJson)}::jsonb
      )
    `;

    const result = await provider.generate({
      projectId: data.projectId,
      sceneId: data.sceneId,
      brief: data.brief,
      startSec: data.startSec,
      endSec: data.endSec,
      capability,
      requestId: id,
      context: context ?? undefined,
    });

    if (!result.ok) {
      await sql`
        update bv_generation_jobs set
          status = ${"failed"},
          error_code = ${result.code},
          error_message = ${result.message},
          result_json = ${JSON.stringify(result)}::jsonb,
          updated_at = now()
        where id = ${id}
      `;
      return {
        jobId: id,
        status: "failed" as const,
        provider: result.provider,
        errorCode: result.code,
        errorMessage: result.message,
        mediaAssetId: null as string | null,
      };
    }

    const assetId = newId();
    await sql`
      insert into bv_media_assets (
        id, project_id, scene_id, job_id, provider, kind,
        url, mime_type, width, height, duration_sec, meta_json
      ) values (
        ${assetId},
        ${data.projectId},
        ${data.sceneId},
        ${id},
        ${result.provider},
        ${result.kind},
        ${result.url},
        ${result.mimeType ?? null},
        ${result.width ?? null},
        ${result.height ?? null},
        ${result.durationSec ?? null},
        ${JSON.stringify(result.meta ?? {})}::jsonb
      )
    `;

    await sql`
      update bv_generation_jobs set
        status = ${"succeeded"},
        media_asset_id = ${assetId},
        result_json = ${JSON.stringify(result)}::jsonb,
        updated_at = now()
      where id = ${id}
    `;

    return {
      jobId: id,
      status: "succeeded" as const,
      provider: result.provider,
      errorCode: null as string | null,
      errorMessage: null as string | null,
      mediaAssetId: assetId,
      mediaUrl: result.url,
    };
  });

export const listGenerationJobs = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<GenerationJobRow>`
      select
        id, project_id, scene_id, provider, status,
        error_code, error_message, request_json, result_json,
        media_asset_id, created_at::text, updated_at::text
      from bv_generation_jobs
      where project_id = ${data.projectId}
      order by created_at desc
      limit 100
    `;
  });

export const listMediaAssets = createServerFn({ method: "GET" })
  .validator(z.object({ projectId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    return sql<MediaAssetRow>`
      select
        id, project_id, scene_id, job_id, provider, kind,
        url, mime_type, width, height, duration_sec, meta_json,
        created_at::text
      from bv_media_assets
      where project_id = ${data.projectId}
      order by created_at desc
      limit 100
    `;
  });

export const getProviderStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getProviderStatusesLive } = await import("./providers/registry.ts");
    return getProviderStatusesLive();
  }
);
