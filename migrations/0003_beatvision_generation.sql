-- Generation jobs and media assets (auth-off: scoped by project_id)
-- Jobs may complete as failed/unavailable; never invent successful media.

create table if not exists bv_generation_jobs (
  id              text primary key,
  project_id      text not null references bv_projects(id) on delete cascade,
  scene_id        text not null,
  provider        text not null,
  status          text not null,
  -- queued | running | succeeded | failed | unavailable
  error_code      text,
  error_message   text,
  request_json    jsonb,
  result_json     jsonb,
  media_asset_id  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bv_generation_jobs_project_idx
  on bv_generation_jobs (project_id, created_at desc);

create table if not exists bv_media_assets (
  id              text primary key,
  project_id      text not null references bv_projects(id) on delete cascade,
  scene_id        text not null,
  job_id          text not null,
  provider        text not null,
  kind            text not null,
  -- image | video | audio | other
  url             text,
  mime_type       text,
  width           integer,
  height          integer,
  duration_sec    double precision,
  meta_json       jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists bv_media_assets_project_idx
  on bv_media_assets (project_id, scene_id);
