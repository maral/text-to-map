import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("city", (t) => {
    t.double("wgs84_latitude").nullable();
    t.double("wgs84_longitude").nullable();
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable("city", (t) => {
    t.dropColumn("wgs84_latitude");
    t.dropColumn("wgs84_longitude");
  });
}
