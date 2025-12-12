import { Alert } from "@deepbounty/sdk/types";
import { query, queryOne } from "@/db/database.js";
import Logger from "../utils/logger.js";
import { sql } from "drizzle-orm";

const logger = new Logger("Alerts");

export interface CreateAlertParams {
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

  // 3. Check wildcard patterns (e.g., *.example.com, *.cdn.apple.com)
  const allWildcards = await query<{ targetId: number; subdomain: string }>(
    sql`SELECT "targetId", subdomain FROM targets_subdomains WHERE subdomain LIKE '*%'`
  );

  for (const wildcardEntry of allWildcards) {
    const wildcardPattern = wildcardEntry.subdomain;

    // Convert wildcard pattern to regex
    // *.example.com should match sub.example.com, api.example.com, etc.
    // *.cdn.apple.com should match api.cdn.apple.com, static.cdn.apple.com, etc.
    if (wildcardPattern.startsWith("*.")) {
      const baseDomain = wildcardPattern.substring(2); // Remove "*."

      // Check if subdomain ends with .baseDomain and has at least one label before
      if (subdomain.endsWith(`.${baseDomain}`)) {
        // Ensure there's at least one subdomain label before the base domain
        const prefix = subdomain.substring(0, subdomain.length - baseDomain.length - 1);
        if (prefix.length > 0 && !prefix.includes("*")) {
          return wildcardEntry.targetId;
        }
      }

      // Also check if subdomain exactly matches the base domain
      // (*.example.com could also match example.com itself in some cases)
      if (subdomain === baseDomain) {
        return wildcardEntry.targetId;
      }
    }
  }

  return null;
}

/**
 * Send a new alert
 * The targetId is automatically detected from the subdomain parameter
 */
export async function createAlert(alertToCreate: CreateAlertParams): Promise<Alert> {
  const { name, subdomain, score, description, endpoint, confirmed = false } = alertToCreate;

  try {
    // Validate score range
    if (score < 0 || score > 4) {
      throw new Error(
        `Invalid score: ${score}. (0=Informational, 1=Low, 2=Medium, 3=High, 4=Critical)`
      );
    }

    // Auto-detect target ID from subdomain
    const targetId = await detectTargetId(subdomain);
    if (!targetId) {
      throw new Error(
        `Could not find target for subdomain: ${subdomain}. Make sure the domain or subdomain is registered.`
      );
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
    return {
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
  } catch (error) {
    logger.error("Error creating alert:", error);
    throw error;
  }
}
