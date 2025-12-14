import { Alert } from "@deepbounty/sdk/types";
import { query, queryOne } from "@/db/database.js";
import Logger from "../utils/logger.js";
import { sql } from "drizzle-orm";
import { sendAlertNotification } from "./notifications/notifier.js";

const logger = new Logger("Alerts");

interface CreateAlertParams {
  name: string;
  subdomain: string;
  score: number;
  description: string;
  endpoint: string;
  confirmed?: boolean;
}

/**
 * Detect target ID from subdomain by checking:
 * 1. Exact match with target's main domain
 * 2. Exact match with registered subdomains
 * 3. Wildcard match with registered subdomain patterns (*.example.com)
 * 4. Parent domain match (check if subdomain ends with any target domain)
 */
async function detectTargetId(subdomain: string): Promise<number | null> {
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
 * Send a new alert
 * The targetId is automatically detected from the subdomain parameter
 * Returns null if no target is found or if an error occurs (instead of throwing)
 */
export async function createAlert(alertToCreate: CreateAlertParams): Promise<Alert | null> {
  const { name, subdomain, score, description, endpoint, confirmed = false } = alertToCreate;

  try {
    // Validate score range
    if (score < 0 || score > 4) {
      logger.warn(
        `Invalid score: ${score}. (0=Informational, 1=Low, 2=Medium, 3=High, 4=Critical)`
      );
      return null;
    }

    // Auto-detect target ID from subdomain
    const targetId = await detectTargetId(subdomain);
    if (!targetId) {
      logger.warn(
        `Skipped alert "${name}": Could not find a matching target for subdomain "${subdomain}".`
      );
      return null;
    }

    // Insert the alert
    const alert = await queryOne<Alert & { targetId: number }>(
      sql`INSERT INTO alerts ("targetId", name, subdomain, score, confirmed, description, endpoint)
       VALUES (${targetId}, ${name}, ${subdomain}, ${score}, ${confirmed}, ${description}, ${endpoint})
       RETURNING id, "targetId", name, subdomain, score, confirmed, description, endpoint, "createdAt"`
    );

    // Enrich with target details for response
    const target = await queryOne<{ name: string; domain: string }>(
      sql`SELECT name, domain FROM targets WHERE id = ${alert.targetId}`
    );

    logger.info(
      `New alert ${alert.id} (${alert.name}) for target ID ${alert.targetId} (subdomain: ${subdomain})`
    );

    // Enrich full alert response
    const fullAlert: Alert = {
      id: alert.id,
      name: alert.name,
      targetName: target?.name ?? "",
      domain: target?.domain ?? "",
      subdomain: alert.subdomain,
      score: alert.score,
      confirmed: alert.confirmed,
      description: alert.description,
      endpoint: alert.endpoint,
      createdAt: new Date(alert.createdAt).toISOString(),
    };

    // Send notification to all configured providers (non-blocking)
    sendAlertNotification(fullAlert.name, fullAlert.targetName);

    return fullAlert;
  } catch (error) {
    // Catch all errors to prevent server crash
    logger.error(`Error creating alert "${name}" for "${subdomain}":`, error);
    return null;
  }
}
