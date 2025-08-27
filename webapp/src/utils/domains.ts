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

// Validate a domain name (ASCII) with a simple, robust check:
// - At least one dot (e.g., example.com)
// - Labels 1-63 chars, a-z 0-9 hyphen, not starting/ending with hyphen
// - TLD 2-63 letters
// - No trailing dot
export function isValidDomain(input: string): boolean {
  const host = normalizeDomain(input);
  if (!host) return false;
  if (host.endsWith(".")) return false;
  if (host.includes("..")) return false;
  const parts = host.split(".");
  if (parts.length < 2) return false;
  // Validate labels
  const labelRe = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const label = parts[i];
    if (label.length < 1 || label.length > 63) return false;
    if (!labelRe.test(label)) return false;
  }
  // Validate TLD
  const tld = parts[parts.length - 1];
  if (!/^[a-z]{2,63}$/.test(tld)) return false;
  return true;
}

// Accept either a normal domain (api.example.com) or a wildcard pattern (*.example.com)
export function isValidSubdomainEntry(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return true; // empty handled elsewhere as "no error"
  if (trimmed.startsWith("*.")) {
    const rest = trimmed.slice(2);
    return isValidDomain(rest);
  }
  return isValidDomain(trimmed);
}
