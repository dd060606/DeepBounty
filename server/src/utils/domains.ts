import config from "./config.js";
import { getTargetsWithDetails } from "@/services/targets.js";
import type { Target } from "@deepbounty/sdk/types";

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

interface ScopeIndex {
  // Identity of the targets array the index was built from.
  source: Target[];
  // Target detection
  domainToId: Map<string, number>;
  subToId: Map<string, number>;
  wildcards: { base: string; id: number; domain: string }[];
  domainsByLenDesc: { id: number; domain: string }[];
  // Scope checking
  activeDomains: Set<string>;
  activeSubScope: Map<string, boolean>;
}

let scopeIndex: ScopeIndex | null = null;

function buildScopeIndex(targets: Target[]): ScopeIndex {
  const domainToId = new Map<string, number>();
  const subToId = new Map<string, number>();
  const wildcards: { base: string; id: number; domain: string }[] = [];
  const domainsByLenDesc: { id: number; domain: string }[] = [];
  const activeDomains = new Set<string>();
  const activeSubScope = new Map<string, boolean>();

  for (const t of targets) {
    if (!domainToId.has(t.domain)) domainToId.set(t.domain, t.id);
    domainsByLenDesc.push({ id: t.id, domain: t.domain });
    if (t.activeScan) activeDomains.add(t.domain);

    const subs: { s: string; oos: boolean }[] = [
      ...(t.subdomains ?? []).map((s) => ({ s, oos: false })),
      ...(t.outOfScopeSubdomains ?? []).map((s) => ({ s, oos: true })),
    ];

    for (const { s, oos } of subs) {
      if (!subToId.has(s)) subToId.set(s, t.id);
      if (s.startsWith("*.")) {
        wildcards.push({ base: s.substring(2), id: t.id, domain: t.domain });
      }
      if (t.activeScan) {
        // On conflict prefer in-scope so we never accidentally exclude a real finding.
        const prev = activeSubScope.get(s);
        if (prev === undefined || prev === true) activeSubScope.set(s, oos);
      }
    }
  }

  // Most-specific-first ordering.
  wildcards.sort((a, b) => b.domain.length - a.domain.length);
  domainsByLenDesc.sort((a, b) => b.domain.length - a.domain.length);

  return {
    source: targets,
    domainToId,
    subToId,
    wildcards,
    domainsByLenDesc,
    activeDomains,
    activeSubScope,
  };
}

async function getScopeIndex(): Promise<ScopeIndex> {
  const targets = await getTargetsWithDetails();
  if (scopeIndex && scopeIndex.source === targets) return scopeIndex;
  scopeIndex = buildScopeIndex(targets);
  return scopeIndex;
}

// Synchronous core of detectTargetId, operating on a prebuilt index.
function detectTargetIdFromIndex(idx: ScopeIndex, subdomain: string): number | null {
  // 1 & 2: exact domain match wins over exact subdomain match.
  const domainId = idx.domainToId.get(subdomain);
  if (domainId !== undefined) return domainId;
  const subId = idx.subToId.get(subdomain);
  if (subId !== undefined) return subId;

  // 3: wildcard patterns (most specific first).
  for (const entry of idx.wildcards) {
    const baseDomain = entry.base;
    // The main-domain case is handled by the fallback pass below.
    if (baseDomain === entry.domain) continue;

    if (subdomain.endsWith(`.${baseDomain}`)) {
      const prefix = subdomain.substring(0, subdomain.length - baseDomain.length - 1);
      if (prefix.length > 0 && !prefix.includes("*")) return entry.id;
    }
    if (subdomain === baseDomain) return entry.id;
  }

  // 4: fallback: hostname belongs to any target's main domain.
  for (const entry of idx.domainsByLenDesc) {
    if (subdomain === entry.domain || subdomain.endsWith(`.${entry.domain}`)) {
      return entry.id;
    }
  }

  return null;
}

// Synchronous core of isHostnameInScope, operating on a prebuilt index.
function isHostnameInScopeFromIndex(idx: ScopeIndex, hostname: string): boolean {
  const normalized = normalizeDomain(hostname);
  if (!isValidDomain(normalized)) return false;

  // Exact match with an active target's main domain.
  if (idx.activeDomains.has(normalized)) return true;

  // Build candidate rules: the hostname itself plus wildcards for it and all parents.
  const parts = normalized.split(".");
  const checks: string[] = [normalized];
  for (let i = 0; i < parts.length; i++) {
    const domain = parts.slice(i).join(".");
    if (!isValidDomain(domain)) continue;
    checks.push(`*.${domain}`);
  }

  // Collect matching subdomain rules from active targets.
  const matches: { subdomain: string; isOutOfScope: boolean }[] = [];
  for (const c of checks) {
    const oos = idx.activeSubScope.get(c);
    if (oos !== undefined) matches.push({ subdomain: c, isOutOfScope: oos });
  }

  if (matches.length === 0) return false;

  // Most specific rule wins (e.g. "*.cdn.domain.com" over "*.domain.com").
  matches.sort((a, b) => b.subdomain.length - a.subdomain.length);
  return !matches[0].isOutOfScope;
}

/**
 * A reusable, synchronous scope checker bound to a snapshot of the scope index.
 *
 * Hot loops should call getScopeChecker() ONCE and then use these synchronous methods per item, instead
 * of awaiting isHostnameInScope()/detectTargetId() per item.
 */
export interface ScopeChecker {
  isInScope(hostname: string): boolean;
  detectTargetId(hostname: string): number | null;
}

/**
 * Build a synchronous scope checker from the current scope index.
 * Await this once before a loop, then call its methods synchronously.
 */
export async function getScopeChecker(): Promise<ScopeChecker> {
  const idx = await getScopeIndex();
  return {
    isInScope: (hostname: string) => isHostnameInScopeFromIndex(idx, hostname),
    detectTargetId: (hostname: string) => detectTargetIdFromIndex(idx, hostname),
  };
}

/**
 * Detect target ID from a subdomain/hostname by checking, in priority order:
 * 1. Exact match with a target's main domain
 * 2. Exact match with a registered subdomain
 * 3. Wildcard match with a registered subdomain pattern (*.example.com)
 * 4. Parent-domain match (hostname ends with any target's main domain)
 */
export async function detectTargetId(subdomain: string): Promise<number | null> {
  const idx = await getScopeIndex();
  return detectTargetIdFromIndex(idx, subdomain);
}

/**
 * Check if a hostname is within scope of an active target,
 * honoring out-of-scope rules with most-specific-match-wins semantics.
 */
export async function isHostnameInScope(hostname: string): Promise<boolean> {
  const idx = await getScopeIndex();
  return isHostnameInScopeFromIndex(idx, hostname);
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
