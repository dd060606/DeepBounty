import { Alert } from "@deepbounty/sdk/types";
import { queryOne } from "@/db/database.js";
import Logger from "../utils/logger.js";
import { sql } from "drizzle-orm";
import { sendAlertNotification } from "./notifications/notifier.js";
import { detectTargetId } from "@/utils/domains.js";

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
