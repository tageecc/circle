/**
 * Provider logos are not loaded from the network; UI falls back to text / icons.
 */
export const PROVIDER_LOGOS: Record<string, string> = {}

export function getProviderLogo(_provider: string): string | undefined {
  return undefined
}

export function hasProviderLogo(_provider: string): boolean {
  return false
}
