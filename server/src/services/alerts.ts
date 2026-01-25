import { Alert } from "@deepbounty/sdk/types";
import { queryOne } from "@/db/database.js";
import Logger from "../utils/logger.js";
import { sql } from "drizzle-orm";
import { sendAlertNotification } from "./notifications/notifier.js";
import { detectTargetId } from "@/utils/domains.js";

const logger = new Logger("Alerts");

interface CreateAlertBaseParams {
  name: string;
  score: number;
  description: string;
  endpoint: string;
  confirmed?: boolean;
}

type CreateAlertParams =
  | (CreateAlertBaseParams & { subdomain: string; targetId?: never })
  | (CreateAlertBaseParams & { targetId: number; subdomain?: string });

/**
 * Send a new alert
 * The targetId is automatically detected from the subdomain parameter
 * Returns null if no target is found or if an error occurs (instead of throwing)
 */
export async function createAlert(alertToCreate: CreateAlertParams): Promise<Alert | null> {
  const { name, score, description, endpoint, confirmed = false } = alertToCreate;
  let subdomainForLog = alertToCreate.subdomain;

  try {
    // Validate score range
    if (score < 0 || score > 4) {
      logger.warn(
        `Invalid score: ${score}. (0=Informational, 1=Low, 2=Medium, 3=High, 4=Critical)`
      );
      return null;
    }

    const useTargetId = typeof (alertToCreate as any).targetId === "number";

    // Resolve target ID and a concrete subdomain value
    let targetId: number | null = null;
    let subdomain: string | undefined = alertToCreate.subdomain;
    let targetDetails: { name: string; domain: string } | null = null;

    if (useTargetId) {
      const target = await queryOne<{ id: number; name: string; domain: string }>(
        sql`SELECT id, name, domain FROM targets WHERE id = ${(alertToCreate as any).targetId}`
      );

      if (!target) {
        logger.warn(
          `Skipped alert "${name}": Could not find a target with ID ${(alertToCreate as any).targetId}.`
        );
        return null;
      }

      targetId = target.id;
      subdomain = subdomain ?? target.domain;
      targetDetails = { name: target.name, domain: target.domain };
    } else {
      // Auto-detect target ID from subdomain
      targetId = await detectTargetId((alertToCreate as any).subdomain);
      subdomain = subdomain ?? (alertToCreate as any).subdomain;
      if (!targetId) {
        logger.warn(
          `Creating alert "${name}" without target association: Could not find a matching target for subdomain "${subdomain}".`
        );
      }
    }

    // Ensure we have a non-empty subdomain value for the DB row
    const subdomainValue = subdomain ?? "";
    subdomainForLog = subdomainValue;

    // Fetch target details if not already available (for response enrichment)
    if (!targetDetails && targetId !== null) {
      targetDetails = await queryOne<{ name: string; domain: string }>(
        sql`SELECT name, domain FROM targets WHERE id = ${targetId}`
      );
    }

    // Insert the alert
    const alert = await queryOne<Alert & { targetId: number | null }>(
      sql`INSERT INTO alerts ("targetId", name, subdomain, score, confirmed, description, endpoint)
       VALUES (${targetId}, ${name}, ${subdomainValue}, ${score}, ${confirmed}, ${description}, ${endpoint})
       RETURNING id, "targetId", name, subdomain, score, confirmed, description, endpoint, "createdAt"`
    );

    // Enrich with target details for response
    const target =
      targetDetails ??
      (alert.targetId
        ? await queryOne<{ name: string; domain: string }>(
            sql`SELECT name, domain FROM targets WHERE id = ${alert.targetId}`
          )
        : null);

    logger.info(
      `New alert ${alert.id} (${alert.name}) for target ID ${alert.targetId ?? "none"} (subdomain: ${subdomainValue})`
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
  } catch (error: any) {
    // Catch all errors to prevent server crash
    logger.error(`Error creating alert "${name}" for "${subdomainForLog ?? "<unknown>"}":`, error);
    if (error.code) logger.error(`Code: ${error.code}`);
    if (error.detail) logger.error(`Detail: ${error.detail}`);
    if (error.hint) logger.error(`Hint: ${error.hint}`);
    if (error.column) logger.error(`Column: ${error.column}`);
    return null;
  }
}
