/**
 * Provider registry. Swap implementations here when real backends are ready.
 * Currently only the null provider is registered — generation stays honest.
 */

import { nullProvider } from "./null-provider.ts";
import type {
  ProviderAvailability,
  ProviderCapability,
  ProviderId,
  SceneMediaProvider,
} from "./types.ts";

const providers: SceneMediaProvider[] = [nullProvider];

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
    const avail = p.availability();
    if (
      avail.available &&
      avail.capabilities.includes(capability)
    ) {
      return { provider: p, availability: avail };
    }
  }
  // Fall back to null provider availability
  const nullAvail = nullProvider.availability();
  return { provider: nullProvider, availability: nullAvail };
}

export function getProviderStatuses(): ProviderAvailability[] {
  return providers.map((p) => p.availability());
}
