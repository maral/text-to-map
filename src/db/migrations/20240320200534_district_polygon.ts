import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("city", (t) => {
    t.text("districts_polygon_geojson", "longtext").nullable();
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable("city", (t) => {
    t.dropColumn("districts_polygon_geojson");
  });
}
