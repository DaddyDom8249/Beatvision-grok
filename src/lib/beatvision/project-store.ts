/**
 * Durable BeatVision project store (server-only).
 * Auth is OFF — rows are unowned. Scope by project id only.
 * Never trust client-sent ownership claims.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";

const DraftSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  lyrics: z.string().default(""),
  creativeDirection: z.string().default(""),
  notes: z.string().default(""),
  audioName: z.string().nullable().optional(),
});

export type ProjectDraft = z.infer<typeof DraftSchema>;

export type ProjectRow = {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
  creative_direction: string;
  notes: string;
  audio_name: string | null;
  duration_sec: number | null;
  world_report: unknown;
  world_state: unknown;
  storyboard: unknown;
  created_at: string;
  updated_at: string;
};

function newId(): string {
  return crypto.randomUUID();
}

/** Create a project from song intake. Returns the new project id. */
export const createProject = createServerFn({ method: "POST" })
  .validator(DraftSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = newId();
    await sql`
      insert into bv_projects (
        id, title, artist, lyrics, creative_direction, notes, audio_name
      ) values (
        ${id},
        ${data.title},
        ${data.artist},
        ${data.lyrics},
        ${data.creativeDirection},
        ${data.notes},
        ${data.audioName ?? null}
      )
    `;
    return { id };
  });

/** Load a project by id. */
export const getProject = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<ProjectRow>`
      select
        id, title, artist, lyrics, creative_direction, notes,
        audio_name, duration_sec, world_report, world_state, storyboard,
        created_at::text, updated_at::text
      from bv_projects
      where id = ${data.id}
      limit 1
    `;
    return rows[0] ?? null;
  });

/** List recent projects (unowned — public by design while auth is off). */
export const listProjects = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await getSql();
    return sql<{
      id: string;
      title: string;
      artist: string;
      updated_at: string;
    }>`
      select id, title, artist, updated_at::text
      from bv_projects
      order by updated_at desc
      limit 20
    `;
  }
);

/** Update song draft fields. */
export const updateProjectDraft = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      draft: DraftSchema,
    })
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update bv_projects set
        title = ${data.draft.title},
        artist = ${data.draft.artist},
        lyrics = ${data.draft.lyrics},
        creative_direction = ${data.draft.creativeDirection},
        notes = ${data.draft.notes},
        audio_name = ${data.draft.audioName ?? null},
        updated_at = now()
      where id = ${data.id}
    `;
    return { ok: true as const };
  });

/** Persist Visual World Report after reveal + confirmation. */
export const saveWorldReport = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      report: z.unknown(),
    })
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update bv_projects set
        world_report = ${JSON.stringify(data.report)}::jsonb,
        updated_at = now()
      where id = ${data.id}
    `;
    return { ok: true as const };
  });

/** Persist Style Bible / characters / environments / visual rules (locked world). */
export const saveWorldState = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      worldState: z.unknown(),
    })
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update bv_projects set
        world_state = ${JSON.stringify(data.worldState)}::jsonb,
        updated_at = now()
      where id = ${data.id}
    `;
    return { ok: true as const };
  });

/** Persist storyboard + optional estimated timeline blob. */
export const saveStoryboard = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      storyboard: z.unknown(),
    })
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update bv_projects set
        storyboard = ${JSON.stringify(data.storyboard)}::jsonb,
        updated_at = now()
      where id = ${data.id}
    `;
    return { ok: true as const };
  });
