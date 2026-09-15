---
name: beatvision-builder
description: Build and complete the BeatVision song-first music visualization platform according to the BeatVision product bible. Use when implementing BeatVision features, architecture, UI, data models, workflows, or integrations.
---

# BeatVision Builder

You are building BeatVision.

Product:
"Every Song Has a World. BeatVision Reveals It."

The BeatVision product bible is the source of truth.

## Non-negotiable product flow

Song intake
→ Reveal World
→ Visual World Report
→ creator confirmation
→ Style Bible
→ Characters
→ Environments
→ Visual Rules
→ References
→ Storyboard
→ Scenes
→ Motion
→ Final Video

## Song-first rule

The song is the master creative and timeline source.

A project begins with:

1. Song title
2. Artist
3. Uploaded audio
4. Lyrics
5. Creative direction
6. Optional creator notes

Do not replace the song-first workflow with a generic AI app builder workflow.

## Reveal World

The primary creative action is:

"Reveal World"

It should transform the song's available information into a Visual World Report containing:

- emotional/musical mood
- emotional arc
- visual language
- cinematography
- environments
- characters
- lighting
- color direction
- visual motifs
- movement
- atmosphere

The creator must be able to review this before generation continues.

## Creator approval

The workflow must contain a clear creator milestone equivalent to:

"Yes, that's my world."

Do not silently proceed from analysis into generation.

## World continuity

Characters, environments, visual rules, references, and style decisions must persist and remain available to later storyboard and generation stages.

Do not independently reinterpret the world in every scene.

## Timeline

The uploaded song remains the master timeline.

Storyboard scenes must map to musical sections and timing.

Never create arbitrary scene timing unrelated to the song.

## Provider architecture

Keep provider integrations behind interfaces.

A missing provider must produce an explicit unavailable state.

Never silently substitute fake output.

Never use placeholder generated media as if it were real provider output.

## Product simplicity

The normal creator should not need to understand AI prompts.

Prompt controls may exist as optional advanced controls.

The default experience should be understandable to a normal musician or creator.

## Architecture rules

Before changing architecture:

1. Inspect the existing implementation.
2. Reuse existing infrastructure.
3. Do not introduce competing state systems.
4. Do not duplicate database models.
5. Do not replace working infrastructure without evidence it is necessary.
6. Preserve existing QA infrastructure.
7. Keep changes incremental and verifiable.

## Forbidden behavior

Do not:

- redesign BeatVision into another product
- add unrelated social features
- add arbitrary dashboards
- create fake AI generation
- invent provider capabilities
- delete working infrastructure simply because it is unused
- claim something works without testing it
- report a successful build without actually running the relevant checks

## Execution loop

Inspect
→ plan
→ implement
→ typecheck
→ test
→ build
→ browser smoke test
→ inspect failures
→ fix
→ repeat

Always report exactly what was implemented and verified.
