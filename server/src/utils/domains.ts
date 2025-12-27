import { query, queryOne } from "@/db/database.js";
import { sql } from "drizzle-orm";

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

/**
 * Extract potential domains/URLs from command strings
 * Returns a list of normalized domains found in the commands
 */
export function extractDomainsFromCommands(commands: string[]): string[] {
  const domains = new Set<string>();

  // Regex patterns to match URLs and domains
  const urlPattern = /https?:\/\/([a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,}))/g;
  const domainPattern =
    /(?:^|[\s"'])((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})(?:[\s\/"']|$)/g;

  for (const cmd of commands) {
    // Extract from URLs (https://example.com)
    let match;
    while ((match = urlPattern.exec(cmd)) !== null) {
      const normalized = normalizeDomain(match[1]);
      if (normalized && isValidDomain(normalized)) {
        domains.add(normalized);
      }
    }

    // Extract standalone domains (example.com)
    while ((match = domainPattern.exec(cmd)) !== null) {
      const normalized = normalizeDomain(match[1]);
      if (normalized && isValidDomain(normalized)) {
        domains.add(normalized);
      }
    }
  }

  return Array.from(domains);
}

/**
 * Detect target ID from subdomain by checking:
 * 1. Exact match with target's main domain
 * 2. Exact match with registered subdomains
 * 3. Wildcard match with registered subdomain patterns (*.example.com)
 * 4. Parent domain match (check if subdomain ends with any target domain)
 */
export async function detectTargetId(subdomain: string): Promise<number | null> {
  // 1. Check if subdomain matches a target's main domain exactly
  const targetByDomain = await queryOne<{ id: number }>(
    sql`SELECT id FROM targets WHERE domain = ${subdomain}`
  );
  if (targetByDomain) {
    return targetByDomain.id;
  }

  // 2. Check if subdomain matches an exact subdomain in targets_subdomains
  const targetByExactSubdomain = await queryOne<{ targetId: number }>(
    sql`SELECT "targetId" FROM targets_subdomains WHERE subdomain = ${subdomain}`
  );
  if (targetByExactSubdomain) {
    return targetByExactSubdomain.targetId;
  }

  // 3. Check wildcard patterns (e.g., *.cdn.other.com pointing to a different target)
  // This handles "exotic" wildcards where the wildcard base domain differs from the target's main domain
  // Note: Simple wildcards like *.example.com (where example.com is the target) are handled by step 4
  const allWildcards = await query<{ targetId: number; subdomain: string; targetDomain: string }>(
    sql`SELECT ts."targetId", ts.subdomain, t.domain as "targetDomain" 
        FROM targets_subdomains ts 
        JOIN targets t ON t.id = ts."targetId"
        WHERE ts.subdomain LIKE '*%'`
  );

  for (const wildcardEntry of allWildcards) {
    const wildcardPattern = wildcardEntry.subdomain;

    if (wildcardPattern.startsWith("*.")) {
      const baseDomain = wildcardPattern.substring(2); // Remove "*."

      // Skip if wildcard matches target's main domain (step 4 will handle this)
      if (baseDomain === wildcardEntry.targetDomain) {
        continue;
      }

      // Only process "exotic" wildcards (e.g., *.cdn.other.com for target example.com)
      if (subdomain.endsWith(`.${baseDomain}`)) {
        const prefix = subdomain.substring(0, subdomain.length - baseDomain.length - 1);
        if (prefix.length > 0 && !prefix.includes("*")) {
          return wildcardEntry.targetId;
        }
      }

      if (subdomain === baseDomain) {
        return wildcardEntry.targetId;
      }
    }
  }

  // 4. Fallback: Check if the subdomain belongs to ANY target's main domain
  // This handles cases like "cdn.domain.com" where "domain.com" is a target
  // but "cdn.domain.com" is not explicitly in targets_subdomains.
  const allTargets = await query<{ id: number; domain: string }>(
    sql`SELECT id, domain FROM targets`
  );

  // Sort by length descending to match the most specific domain first
  // e.g. match "api.staging.example.com" to "staging.example.com" before "example.com"
  allTargets.sort((a, b) => b.domain.length - a.domain.length);

  for (const target of allTargets) {
    // Check if subdomain IS the domain OR ends with .domain
    // This prevents "myteamviewer.com" from matching "teamviewer.com"
    if (subdomain === target.domain || subdomain.endsWith(`.${target.domain}`)) {
      return target.id;
    }
  }

  return null;
}

/**
 * Check if a hostname is in scope
 */
export async function isHostnameInScope(hostname: string): Promise<boolean> {
  const normalized = normalizeDomain(hostname);
  if (!isValidDomain(normalized)) return false;

  // 1. Check if hostname is a main target (exact match only)
  const targetMatch = await queryOne(
    sql`SELECT 1 FROM targets WHERE domain = ${normalized} LIMIT 1`
  );
  if (targetMatch) return true;

  const parts = normalized.split(".");
  const checks: string[] = [];

  // Exact match of the hostname itself
  checks.push(normalized);

  // Wildcards for hostname and all parents
  // e.g. for api.example.com:
  // - *.api.example.com (covers self)
  // - *.example.com (covers child)
  for (let i = 0; i < parts.length; i++) {
    const domain = parts.slice(i).join(".");
    if (!isValidDomain(domain)) continue;
    checks.push(`*.${domain}`);
  }

  if (checks.length === 0) return false;

  // Check targets_subdomains for any matches
  const subdomainsQuery = sql`SELECT 1 FROM targets_subdomains WHERE subdomain IN ${checks} LIMIT 1`;
  const subdomainMatch = await queryOne(subdomainsQuery);

  return !!subdomainMatch;
}
