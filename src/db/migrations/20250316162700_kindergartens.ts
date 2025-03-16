import { Knex } from "knex";
import { SchoolType } from "../types";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("school", (t) => {
    t.tinyint("type", 2).defaultTo(SchoolType.Elementary);
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable("city", (t) => {
    t.dropColumn("type");
  });
}
