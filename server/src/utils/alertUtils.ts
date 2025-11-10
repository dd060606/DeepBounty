import { Alert } from "@deepbounty/sdk/types";
import { query, queryOne } from "./db.js";
import Logger from "./logger.js";
import { sql } from "drizzle-orm";

const logger = new Logger("Alerts");

export interface CreateAlertParams {
  targetId: number;
  name: string;
  subdomain: string;
  score: number;
  description: string;
  endpoint: string;
  confirmed?: boolean;
}

/**
 * Send a new alert
 */
export async function createAlert(alertToCreate: CreateAlertParams): Promise<Alert> {
  const {
    targetId,
    name,
    subdomain,
    score,
    description,
    endpoint,
    confirmed = false,
  } = alertToCreate;

  try {
    // Validate score range
    if (score < 0 || score > 4) {
      throw new Error(
        `Invalid score: ${score}. (0=Informational, 1=Low, 2=Medium, 3=High, 4=Critical)`
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

    logger.info(`New alert ${alert.id} (${alert.name}) for target ID ${alert.targetId}`);
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
