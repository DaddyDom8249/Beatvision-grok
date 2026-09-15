/**
 * Durable generation jobs + media assets.
 * Creating a job always attempts a real provider path; unavailable is explicit.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import {
  resolveProvider,
  type ProviderCapability,
} from "./providers/index.ts";

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

const CreateJobSchema = z.object({
  projectId: z.string().min(1),
  sceneId: z.string().min(1),
  brief: z.string().min(1),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  capability: z.enum(["still_image", "video_clip", "motion"]),
});

/**
 * Create and attempt a generation job.
 * If no provider is available, status is "unavailable" with a clear message.
 * Never inserts a fake media asset on failure.
 */
export const createGenerationJob = createServerFn({ method: "POST" })
  .validator(CreateJobSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = newId();
    const capability = data.capability as ProviderCapability;
    const { provider, availability } = resolveProvider(capability);

    const requestJson = {
      projectId: data.projectId,
      sceneId: data.sceneId,
      brief: data.brief,
      startSec: data.startSec,
      endSec: data.endSec,
      capability,
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

    // Mark running, then call provider
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
    const { getProviderStatuses } = await import("./providers/registry.ts");
    return getProviderStatuses();
  }
);
