/**
 * Provider registry. Arena is preferred when configured and healthy.
 * Null provider remains for explicit no-provider development only.
 */

import { arenaProvider } from "./arena-provider.ts";
import { nullProvider } from "./null-provider.ts";
import type {
  ProviderAvailability,
  ProviderCapability,
  ProviderId,
  SceneMediaProvider,
} from "./types.ts";

/** Order matters: first available matching capability wins. */
const providers: SceneMediaProvider[] = [arenaProvider, nullProvider];

export function listProviders(): SceneMediaProvider[] {
  return [...providers];
}

export function getProvider(id: ProviderId): SceneMediaProvider | null {
  return providers.find((p) => p.id === id) ?? null;
}

/** Prefer first available provider that supports the capability. */
export function resolveProvider(
  capability: ProviderCapability
): { provider: SceneMediaProvider; availability: ProviderAvailability } {
  for (const p of providers) {
    if (p.id === "none") continue;
    const avail = p.availability();
    if (avail.available && avail.capabilities.includes(capability)) {
      return { provider: p, availability: avail };
    }
  }
  // If Arena is registered but unavailable, surface that reason — do not silently
  // pretend null is the primary path when Arena was the intended provider.
  const arena = providers.find((p) => p.id === "beatvision-arena");
  if (arena) {
    const a = arena.availability();
    if (!a.available && arena.capabilities.includes(capability)) {
      return { provider: arena, availability: a };
    }
  }
  const nullAvail = nullProvider.availability();
  return { provider: nullProvider, availability: nullAvail };
}

export function getProviderStatuses(): ProviderAvailability[] {
  return providers.map((p) => p.availability());
}

/** Live status (health check for Arena). Does not trigger generation. */
export async function getProviderStatusesLive(): Promise<
  ProviderAvailability[]
> {
  const out: ProviderAvailability[] = [];
  for (const p of providers) {
    if (p.checkAvailability) {
      out.push(await p.checkAvailability());
    } else {
      out.push(p.availability());
    }
  }
  return out;
}
