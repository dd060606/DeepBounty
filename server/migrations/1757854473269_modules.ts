import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("modules_configs", {
    id: "id",
    moduleId: { type: "text", notNull: true },
    key: { type: "text", notNull: true },
    value: { type: "jsonb", notNull: true },
  });

  pgm.addConstraint("modules_configs", "modules_configs_unique_module_key", {
    unique: ["moduleId", "key"],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {}
