export function normalizeDomain(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.toLowerCase();
  } catch {
    // fallback: keep raw, but lowercased
    return trimmed.toLowerCase();
  }
}

export function defaultWildcard(domain: string): string {
  const d = normalizeDomain(domain);
  return d ? `*.${d}` : "";
}

export function faviconUrl(domain: string): string | null {
  const d = normalizeDomain(domain);
  if (!d) return null;
  // Use Google S2 favicons
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
}
