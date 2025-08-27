import { MigrationBuilder } from "node-pg-migrate";

export const up = (pgm: MigrationBuilder) => {
  pgm.createTable("targets", {
    id: "id",
    name: { type: "text", notNull: true },
    domain: { type: "text", notNull: true },
    activeScan: { type: "boolean", notNull: true, default: true },
    createdAt: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });
  pgm.createTable("targets_subdomains", {
    id: "id",
    targetId: { type: "integer", notNull: true, references: "targets(id)", onDelete: "CASCADE" },
    subdomain: { type: "text", notNull: true },
  });
};

export async function down(pgm: MigrationBuilder): Promise<void> {}
