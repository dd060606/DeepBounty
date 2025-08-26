import { MigrationBuilder } from "node-pg-migrate";

export const up = (pgm: MigrationBuilder) => {
  pgm.createTable("targets", {
    id: "id",
    name: { type: "text", notNull: true },
    domain: { type: "text", notNull: true },
    active_scan: { type: "boolean", notNull: true, default: true },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });
  pgm.createTable("targets_subdomains", {
    id: "id",
    target_id: { type: "integer", notNull: true, references: "targets(id)", onDelete: "CASCADE" },
    subdomain: { type: "text", notNull: true },
  });
};

export async function down(pgm: MigrationBuilder): Promise<void> {}
