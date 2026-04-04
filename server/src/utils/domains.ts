import { query, queryOne } from "@/db/database.js";
import { sql } from "drizzle-orm";
import config from "./config.js";

const CACHE_TTL_MS = 60000;

// Simple in-memory Maps to hold our cached database answers
const targetIdCache = new Map<string, { value: number | null; timestamp: number }>();
const scopeCache = new Map<string, { value: boolean; timestamp: number }>();

// In-flight promises to prevent cache stampedes / thundering herd during mass ingestion
const targetIdInFlight = new Map<string, Promise<number | null>>();
const scopeInFlight = new Map<string, Promise<boolean>>();

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

// Detect target ID from subdomain
export async function detectTargetId(subdomain: string): Promise<number | null> {
  const now = Date.now();
  const cached = targetIdCache.get(subdomain);

  // If we have a fresh cached value, return it instantly!
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  // If already querying this subdomain, wait for that promise to resolve
  const inFlight = targetIdInFlight.get(subdomain);
  if (inFlight) {
    return await inFlight;
  }

  // Otherwise, ask the database and store the result
  const promise = _detectTargetId(subdomain).then((result) => {
    targetIdCache.set(subdomain, { value: result, timestamp: Date.now() });
    targetIdInFlight.delete(subdomain);
    return result;
  }).catch((err) => {
    targetIdInFlight.delete(subdomain);
    throw err;
  });

  targetIdInFlight.set(subdomain, promise);
  return await promise;
}

// Check if a hostname is in scope with caching
export async function isHostnameInScope(hostname: string): Promise<boolean> {
  const normalized = normalizeDomain(hostname);
  if (!isValidDomain(normalized)) return false;

  const now = Date.now();
  const cached = scopeCache.get(normalized);

  // Return instantly if cached
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  // If already querying this hostname, wait for that promise to resolve
  const inFlight = scopeInFlight.get(normalized);
  if (inFlight) {
    return await inFlight;
  }

  // Ask database and store the result
  const promise = _isHostnameInScope(normalized).then((result) => {
    scopeCache.set(normalized, { value: result, timestamp: Date.now() });
    scopeInFlight.delete(normalized);
    return result;
  }).catch((err) => {
    scopeInFlight.delete(normalized);
    throw err;
  });

  scopeInFlight.set(normalized, promise);
  return await promise;
}

/**
 * Detect target ID from subdomain by checking:
 * 1. Exact match with target's main domain
 * 2. Exact match with registered subdomains
 * 3. Wildcard match with registered subdomain patterns (*.example.com)
 * 4. Parent domain match (check if subdomain ends with any target domain)
 */
export async function _detectTargetId(subdomain: string): Promise<number | null> {
  // 1. Check if subdomain matches a target's main domain exactly
  // Combine 1 & 2 into a single fast query to reduce database roundtrips, keeping priority
  const directMatch = await queryOne<{ id: number }>(
    sql`
      SELECT id, 1 as priority FROM targets WHERE domain = ${subdomain}
      UNION ALL
      SELECT "targetId" as id, 2 as priority FROM targets_subdomains WHERE subdomain = ${subdomain}
      ORDER BY priority ASC
      LIMIT 1
    `
  );

  if (directMatch) {
    return directMatch.id;
  }

  // 3. Combine Wildcards and Fallback Checks into a single memory pass
  // This fetches only the necessary rules to evaluate wildcard domains locally
  const allTargetsAndWildcards = await query<{ id: number; domain: string; subdomain: string | null }>(
    sql`
      SELECT id, domain, NULL as subdomain FROM targets
      UNION ALL
      SELECT t.id, t.domain, ts.subdomain
      FROM targets_subdomains ts
      JOIN targets t ON t.id = ts."targetId"
      WHERE ts.subdomain LIKE '*%'
    `
  );

  // We sort by length descending to match the most specific domain first.
  allTargetsAndWildcards.sort((a, b) => b.domain.length - a.domain.length);

  // First pass: Wildcards only (Priority 3)
  for (const entry of allTargetsAndWildcards) {
    if (entry.subdomain && entry.subdomain.startsWith("*.")) {
      const baseDomain = entry.subdomain.substring(2);

      // Skip if wildcard matches target's main domain (fallback will handle this)
      if (baseDomain === entry.domain) {
        continue;
      }

      if (subdomain.endsWith(`.${baseDomain}`)) {
        const prefix = subdomain.substring(0, subdomain.length - baseDomain.length - 1);
        if (prefix.length > 0 && !prefix.includes("*")) {
          return entry.id;
        }
      }

      if (subdomain === baseDomain) {
        return entry.id;
      }
    }
  }

  // Second pass: Fallback main domains only (Priority 4)
  for (const entry of allTargetsAndWildcards) {
    if (!entry.subdomain) {
      // 4. Fallback: Check if the subdomain belongs to ANY target's main domain
      // This handles cases like "cdn.domain.com" where "domain.com" is a target
      // but "cdn.domain.com" is not explicitly in targets_subdomains.
      if (subdomain === entry.domain || subdomain.endsWith(`.${entry.domain}`)) {
        return entry.id;
      }
    }
  }

  return null;
}

/**
 * Check if a hostname is in scope
 */
export async function _isHostnameInScope(hostname: string): Promise<boolean> {
  const normalized = normalizeDomain(hostname);
  if (!isValidDomain(normalized)) return false;

  const parts = normalized.split(".");
  const checks: string[] = [];

  // Exact match of the hostname itself
  checks.push(normalized);

  // Wildcards for hostname and all parents
  for (let i = 0; i < parts.length; i++) {
    const domain = parts.slice(i).join(".");
    if (!isValidDomain(domain)) continue;
    checks.push(`*.${domain}`);
  }

  if (checks.length === 0) return false;

  // Fetch target match and all matching rules in a single query
  const results = await query<{ isTargetMatch: boolean; isOutOfScope: boolean; subdomain: string }>(
    sql`
    SELECT true as "isTargetMatch", false as "isOutOfScope", domain as "subdomain"
    FROM targets WHERE domain = ${normalized} AND "activeScan" = true
    UNION ALL
    SELECT false as "isTargetMatch", ts."isOutOfScope", ts.subdomain
    FROM targets_subdomains ts
    JOIN targets t ON t.id = ts."targetId"
    WHERE ts.subdomain IN ${checks}
      AND t."activeScan" = true
  `
  );

  const targetMatch = results.find(r => r.isTargetMatch);
  if (targetMatch) return true;

  const matches = results.filter(r => !r.isTargetMatch);

  if (matches.length === 0) return false;

  // Determine "Most Specific Match"
  // We sort by length descending.
  // "*.cdn.domain.com" (length 16) is more specific than "*.domain.com" (length 12)
  matches.sort((a, b) => b.subdomain.length - a.subdomain.length);

  const bestMatch = matches[0];

  // Return true only if the most specific rule is NOT out of scope
  return !bestMatch.isOutOfScope;
}

/*
 * Get external hostname from config URL
 */
export function getExternalHostname(): string | null {
  try {
    const url = new URL(config.get().externalUrl);
    return url.hostname;
  } catch {
    return null;
  }
}
