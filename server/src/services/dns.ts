import dns2 from "dns2";
import Logger from "@/utils/logger.js";
import { getExternalHostname } from "@/utils/domains.js";
import { CallbackTriggerData } from "@deepbounty/sdk/types";
import { triggerCallback } from "./callbacks.js";

interface ChunkSession {
  total: number;
  receivedCount: number;
  chunks: string[];
  lastUpdate: number;
}

// Buffer to store partial chunks.
// Key: `${uuid}_${ip}` (Unique per callback AND per source IP to prevent collisions)
const chunkBuffer = new Map<string, ChunkSession>();

// Cleanup incomplete transfers older than 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of chunkBuffer.entries()) {
    if (now - session.lastUpdate > 60000) {
      chunkBuffer.delete(key);
    }
  }
}, 30000);

export class DnsService {
  private server: any;
  private logger = new Logger("DNS");
  private isRunning: boolean = false;

  constructor() {
    // Create the UDP DNS Server
    this.server = dns2.createServer({
      udp: true,
      handle: (request, send, rinfo) => this.handleQuery(request, send, rinfo),
    });
  }

  public async start() {
    this.server.on("error", (err: Error) => {
      this.logger.warn(
        `Failed to start DNS Service, callbacks over DNS will not work: ${err.message}`
      );
      this.shutdown();
    });
    await this.server.listen({ udp: 5300 });

    this.isRunning = true;
    this.logger.info("Service started successfully on UDP 5300");
  }

  public stop() {
    this.shutdown();
  }

  private shutdown() {
    if (this.isRunning && this.server) {
      this.server.close();
    }
    this.isRunning = false;
    chunkBuffer.clear();
  }

  private async handleQuery(request: any, send: any, rinfo: any) {
    const response = dns2.Packet.createResponseFromRequest(request);
    const [question] = request.questions;
    const name = question.name.toLowerCase();

    const baseDomain = getExternalHostname();

    if (!baseDomain) {
      this.logger.error("External hostname is not configured. Cannot process DNS queries.");
      send(response);
      return;
    }

    // Filter queries meant for our domain
    if (name.endsWith(baseDomain)) {
      // Remove domain suffix
      const prefix = name.slice(0, -(baseDomain.length + 1));
      const parts = prefix.split(".");

      // Expected format: [index-total].[hex_uuid].[hex_data]
      if (parts.length >= 3) {
        const [sequence, hexUuid, hexData] = parts;

        // 1. Restore Standard UUID format (insert hyphens)
        const uuid = this.restoreUuid(hexUuid);

        if (uuid) {
          await this.processChunk(uuid, sequence, hexData, rinfo);
        }
      } else {
        this.logger.warn(`Malformed DNS query received: ${name}`);
      }
    } else {
      this.logger.warn(`Received DNS query for unexpected domain: ${name}`);
    }

    // Always return a dummy answer (A Record -> 127.0.0.1)
    // This stops the DNS resolver from retrying immediately
    response.answers.push({
      name: name,
      type: dns2.Packet.TYPE.A,
      class: dns2.Packet.CLASS.IN,
      ttl: 300,
      address: "127.0.0.1",
    });

    send(response);
  }

  private async processChunk(uuid: string, sequence: string, hexData: string, rinfo: any) {
    try {
      const [indexStr, totalStr] = sequence.split("-");
      const index = parseInt(indexStr, 10);
      const total = parseInt(totalStr, 10);

      if (isNaN(index) || isNaN(total)) return;

      // Create a unique session key using UUID + Sender IP
      // This allows multiple targets to exfiltrate to the same UUID simultaneously
      const sessionKey = `${uuid}_${rinfo.address}`;

      if (!chunkBuffer.has(sessionKey)) {
        chunkBuffer.set(sessionKey, {
          total,
          receivedCount: 0,
          chunks: new Array(total).fill(null),
          lastUpdate: Date.now(),
        });
      }

      const session = chunkBuffer.get(sessionKey)!;
      session.lastUpdate = Date.now();

      // Only process if we haven't received this specific chunk yet
      if (!session.chunks[index]) {
        session.chunks[index] = hexData;
        session.receivedCount++;

        this.logger.info(
          `Received chunk ${index + 1}/${total} for callback ${uuid} from ${rinfo.address}`
        );

        // Check if all chunks have arrived
        if (session.receivedCount === session.total) {
          await this.finalizeTransfer(uuid, session, rinfo, sessionKey);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing chunk: ${error}`);
    }
  }

  private async finalizeTransfer(
    uuid: string,
    session: ChunkSession,
    rinfo: any,
    sessionKey: string
  ) {
    try {
      // 1. Reassemble Hex String
      const fullHex = session.chunks.join("");

      // 2. Decode Hex -> JSON String
      const jsonString = Buffer.from(fullHex, "hex").toString("utf-8");

      // 3. Parse JSON Object
      const data = JSON.parse(jsonString);

      // 4. Trigger Callback
      const triggerData: CallbackTriggerData = {
        body: data,
        headers: {},
        remoteIp: rinfo.address,
        userAgent: "DNS",
        triggeredAt: new Date().toISOString(),
      };

      this.logger.info(`Callback triggered: ${uuid} from ${triggerData.remoteIp}`);

      const result = await triggerCallback(uuid, triggerData);

      if (!result.success) {
        this.logger.warn(`Callback trigger failed: ${uuid} - ${result.error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to decode final JSON: ${error}`);
    } finally {
      // Remove from memory immediately upon completion
      chunkBuffer.delete(sessionKey);
    }
  }

  // Helper: Converts "550e8400e29b..." back to "550e8400-e29b-..."
  private restoreUuid(hex: string): string | null {
    if (hex.length !== 32) return null;
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }
}
