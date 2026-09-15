-- BeatVision projects (auth-off: unowned rows, world-readable/writable by id)
-- No user_id. No bulk delete. Personal data not stored beyond song creative inputs.

create table if not exists bv_projects (
  id                  text primary key,
  title               text not null,
  artist              text not null,
  lyrics              text not null default '',
  creative_direction  text not null default '',
  notes               text not null default '',
  audio_name          text,
  duration_sec        double precision,
  world_report        jsonb,
  world_state         jsonb,
  storyboard          jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists bv_projects_updated_at_idx
  on bv_projects (updated_at desc);
