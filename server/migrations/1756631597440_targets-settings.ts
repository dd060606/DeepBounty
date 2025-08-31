import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("targets_settings", {
    id: "id",
    targetId: { type: "integer", notNull: true, references: "targets(id)", onDelete: "CASCADE" },
    settings: {
      type: "jsonb",
      notNull: true,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {}
