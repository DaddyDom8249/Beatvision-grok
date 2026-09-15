---
name: beatvision-phase
description: Implement exactly one BeatVision development phase at a time, preserving existing architecture and verifying the result before proceeding.
---

# BeatVision Phase Execution

Implement only the requested BeatVision phase.

Do not redesign unrelated parts of the application.

## Before coding

1. Read AGENTS.md.
2. Read the BeatVision product requirements.
3. Inspect existing routes.
4. Inspect existing components.
5. Inspect existing database/data models.
6. Inspect existing provider interfaces.
7. Inspect existing tests.
8. Identify reusable infrastructure.

Then state:

- what already exists
- what is missing
- what files need to change
- what must not change

## Implementation rules

Build the smallest complete implementation of the requested phase.

Do not create fake functionality.

Do not create placeholder UI that pretends to perform work.

If an external provider is unavailable:

- expose a real unavailable state
- preserve the workflow
- do not fabricate successful output

## Verification

After implementation:

1. typecheck
2. unit tests
3. build
4. browser smoke test
5. mobile browser smoke test when UI changed
6. verify persistence when state/data changed

Fix failures before reporting completion.

## Completion rule

A phase is complete only when:

- implementation exists
- user workflow works
- persistence works where required
- errors are handled
- tests pass
- browser verification passes

Do not begin the next phase automatically.
