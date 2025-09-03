import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("alerts", {
    id: "id",
    targetId: { type: "integer", notNull: true, references: "targets(id)", onDelete: "CASCADE" },
    name: { type: "text", notNull: true },
    subdomain: { type: "text", notNull: true },
    score: { type: "smallint", notNull: true },
    confirmed: { type: "boolean", notNull: true },
    description: { type: "text", notNull: true },
    endpoint: { type: "text", notNull: true },
    createdAt: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {}
