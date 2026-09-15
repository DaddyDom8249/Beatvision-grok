---
name: beatvision-audit
description: Audit the BeatVision repository against the BeatVision product bible, implementation completeness, architecture, persistence, provider execution, and browser behavior. Use before claiming a feature or phase is complete.
---

# BeatVision Audit

Perform a real repository audit.

Do not infer implementation from filenames, comments, documentation, or intended architecture.

Inspect the actual code.

## Audit categories

### 1. Product workflow

Verify whether these actually exist and work:

- project creation
- song title
- artist
- audio upload
- lyrics
- creative direction
- notes
- Reveal World
- Visual World Report
- creator approval
- Style Bible
- Characters
- Environments
- Visual Rules
- References
- Storyboard
- Scenes
- Motion
- Final video

### 2. Persistence

Determine:

- what is stored
- where it is stored
- whether refresh preserves state
- whether project state survives browser restart
- whether uploaded audio persists
- whether generated assets persist
- whether state is correctly scoped to a project

### 3. Song/timeline integrity

Verify that:

- audio is actually available
- duration is obtained correctly
- storyboard timing derives from the song
- scenes have deterministic timing
- scenes do not silently recycle unrelated media
- final assembly uses the actual song

### 4. Generation

For every provider:

- identify the interface
- identify the implementation
- identify authentication requirements
- identify failure behavior
- identify whether output is real
- identify whether placeholder/fallback media exists

A provider must never be described as functional merely because an interface exists.

### 5. Browser verification

Run the actual application.

Check:

- desktop
- mobile
- console errors
- page errors
- broken routes
- buttons
- forms
- upload behavior
- persistence
- major workflow transitions

### 6. Code quality

Check:

- TypeScript
- build
- tests
- dead code
- duplicate systems
- contradictory data models
- unreachable routes
- fake implementations
- TODOs hiding required functionality

## Verdict levels

Use:

PASS
PARTIAL
FAIL
BLOCKED

Never use "complete" unless the actual behavior has been verified.

## Output

Return:

1. Overall score
2. Product completeness percentage
3. Working functionality
4. Partial functionality
5. Missing functionality
6. Blocking defects
7. Architecture risks
8. Tests actually executed
9. Exact next implementation phase

Do not modify the repository during an audit unless explicitly instructed.
