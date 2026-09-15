---
name: beatvision-no-fake
description: Prevent fake, simulated, placeholder, recycled, or falsely reported functionality in BeatVision. Use when implementing or reviewing generation, rendering, providers, persistence, or completion claims.
---

# BeatVision No-Fake Rule

BeatVision must never pretend that functionality exists when it does not.

## Never

Never:

- return a placeholder image as generated output
- reuse an unrelated scene and call it generated
- recycle one clip across multiple scenes without explicit authorization
- fabricate provider responses
- fake video rendering
- fake audio analysis
- fake persistence
- hardcode successful API responses
- silently fall back to demo data
- report an unavailable provider as operational
- mark a job complete when execution failed

## Provider failures

If a provider is:

- unavailable
- missing credentials
- rate limited
- out of credits
- unreachable
- unsupported

return an explicit failure/unavailable state.

The UI must tell the truth.

## Media integrity

Every generated asset must have traceable:

- project ID
- scene ID
- generation job ID
- provider
- source/reference information where applicable

## Verification

Before declaring media generation successful:

1. confirm the provider request completed
2. confirm an actual output exists
3. confirm the output belongs to the requested scene
4. confirm the output can be loaded
5. confirm it is not merely a placeholder/demo asset

Truthful failure is better than fake success.
