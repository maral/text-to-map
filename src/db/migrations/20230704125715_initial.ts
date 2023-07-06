import { Knex } from "knex";
import { isPostgres, isSqlite } from "../db";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("prague_district", function (table_10) {
    table_10.integer("code").primary().notNullable();
    table_10.text("name").notNullable();
  });
  await knex.schema.createTable("school", function (table_12) {
    table_12.text("izo").primary();
    table_12.text("redizo").notNullable();
    table_12.text("name").notNullable();
    table_12.integer("capacity").notNullable();
  });
  await knex.schema.createTable("founder_type", function (table_5) {
    table_5.integer("code").primary().notNullable();
    table_5.text("name").notNullable();
  });
  await knex.schema.createTable("meta", function (table_6) {
    table_6.text("key").primary().notNullable();
    table_6.text("value").notNullable();
  });
  await knex.schema.createTable("municipality_part", function (table_7) {
    table_7.integer("code").primary().notNullable();
    table_7.text("name").notNullable();
  });
  await knex.schema.createTable("object_type", function (table_8) {
    table_8.integer("id").primary().notNullable();
    table_8.text("name").notNullable();
  });
  await knex.schema.createTable("street_sync", function (table_16) {
    table_16.text("feed_url").primary().notNullable();
  });
  await knex.schema.createTable("region", function (table_11) {
    table_11.integer("code").primary().notNullable();
    table_11.text("name").notNullable();
    table_11.text("short_name").notNullable();
    table_11.integer("csu_code_100").notNullable();
    table_11.text("csu_code_108_nuts").notNullable();
  });
  await knex.schema.createTable("county", function (table_3) {
    table_3.integer("code").primary().notNullable();
    table_3.text("name").notNullable();
    table_3.integer("csu_code_101_lau").notNullable();
    table_3.text("csu_code_109_nuts").notNullable();
    table_3
      .integer("region_code")
      .references("code")
      .inTable("region")
      .notNullable();
  });
  await knex.schema.createTable("orp", function (table_9) {
    table_9.integer("code").primary().notNullable();
    table_9.text("name").notNullable();
    table_9.integer("csu_code_65").notNullable();
    table_9
      .integer("region_code")
      .references("code")
      .inTable("region")
      .notNullable();
    table_9
      .integer("county_code")
      .references("code")
      .inTable("county")
      .notNullable();
  });
  await knex.schema.createTable("city", function (table_1) {
    table_1.integer("code").primary().notNullable();
    table_1.text("name").notNullable();
    table_1.integer("region_code").references("code").inTable("region");
    table_1.integer("county_code").references("code").inTable("county");
    table_1.integer("orp_code").references("code").inTable("orp");
  });
  await knex.schema.createTable("city_district", function (table_2) {
    table_2.integer("code").primary().notNullable();
    table_2
      .integer("city_code")
      .references("code")
      .inTable("city")
      .notNullable();
    table_2.text("name").notNullable();
  });
  await knex.schema.createTable("street", function (table_15) {
    table_15.integer("code").primary().notNullable();
    table_15
      .integer("city_code")
      .references("code")
      .inTable("city")
      .notNullable();
    table_15.text("name").notNullable();
  });
  await knex.schema.createTable("founder", function (table_4) {
    table_4.increments("id");
    table_4.text("name").notNullable();
    table_4.text("short_name").notNullable();
    table_4.text("ico").notNullable();
    table_4
      .integer("founder_type_code")
      .references("code")
      .inTable("founder_type")
      .notNullable();
    table_4.integer("city_code").references("code").inTable("city");
    table_4
      .integer("city_district_code")
      .references("code")
      .inTable("city_district");
    table_4.unique(["name", "ico"]);
  });
  await knex.schema.createTable("school_founder", function (table_13) {
    table_13.increments("id");
    table_13
      .text("school_izo")
      .references("izo")
      .inTable("school")
      .notNullable();
    table_13
      .integer("founder_id")
      .references("id")
      .inTable("founder")
      .notNullable();
  });
  await knex.schema.createTable("address_point", function (table) {
    table.increments("id");
    table.integer("street_code").references("code").inTable("street");
    table
      .integer("object_type_id")
      .references("id")
      .inTable("object_type")
      .notNullable();
    table.integer("descriptive_number");
    table.integer("orientational_number");
    table.text("orientational_number_letter");
    table.integer("city_code").references("code").inTable("city").notNullable();
    table
      .integer("city_district_code")
      .references("code")
      .inTable("city_district");
    table
      .integer("municipality_part_code")
      .references("code")
      .inTable("municipality_part");
    table
      .integer("prague_district_code")
      .references("code")
      .inTable("prague_district");
    table.text("postal_code").notNullable();
    table.double("jtsk_x");
    table.double("jtsk_y");
    table.double("wgs84_latitude");
    table.double("wgs84_longitude");
  });
  await knex.schema.createTable("school_location", function (table_14) {
    table_14.increments("id");
    table_14
      .text("school_izo")
      .references("izo")
      .inTable("school")
      .notNullable();
    table_14
      .integer("address_point_id")
      .references("id")
      .inTable("address_point")
      .notNullable()
      .onDelete("CASCADE");
    table_14.unique(["school_izo", "address_point_id"]);
  });

  await knex("founder_type").insert([
    { code: 0, name: "Zatím neurčeno" },
    { code: 101, name: "Fyzická osoba" },
    { code: 161, name: "Ústav" },
    { code: 211, name: "Ústřední orgány státní správy" },
    { code: 212, name: "Územní orgány státní správy" },
    { code: 221, name: "Veřejná obchodní společnost" },
    { code: 222, name: "Komanditní společnost" },
    { code: 223, name: "Akciová společnost" },
    { code: 224, name: "Společnost s ručením omezeným" },
    { code: 225, name: "Družstvo" },
    { code: 226, name: "Státní podnik" },
    { code: 227, name: "Evropská společnost" },
    { code: 228, name: "Evropské hospodářské zájmové sdružení" },
    { code: 231, name: "Nadace" },
    { code: 232, name: "Zájmové sdružení právnických osob" },
    { code: 233, name: "Nadační fond" },
    { code: 241, name: "Církev, náboženská společnost" },
    { code: 242, name: "Církevní organizace" },
    { code: 251, name: "Občanské sdružení" },
    {
      code: 252,
      name: "Organizační jednotka občanského sdružení s právní subjektivitou",
    },
    { code: 261, name: "Obec" },
    { code: 262, name: "Obecní podnik" },
    { code: 263, name: "Městská část / městský obvod" },
    { code: 264, name: "Svazek obcí" },
    { code: 266, name: "Kraj" },
    { code: 271, name: "Politická strana, politické hnutí" },
    { code: 281, name: "Obecně prospěšná společnost" },
    { code: 291, name: "Veřejná vysoká škola" },
    { code: 301, name: "Fyzická osoba s bydlištěm v zahraničí" },
    { code: 302, name: "Právnická osoba se sídlem v zahraničí" },
    { code: 706, name: "Spolek" },
    { code: 736, name: "Pobočný spolek" },
  ]);
  await knex("object_type").insert([
    { id: 1, name: "č.p." },
    { id: 2, name: "č.ev." },
  ]);
  await knex.schema.raw("CREATE INDEX city_code ON address_point (city_code);");
  await knex.schema.raw(
    "CREATE INDEX city_district_code ON address_point (city_district_code);"
  );
  await knex.schema.raw(
    "CREATE INDEX municipality_part_code ON address_point (municipality_part_code);"
  );
  await knex.schema.raw(
    "CREATE INDEX object_type_id ON address_point (object_type_id);"
  );
  await knex.schema.raw(
    "CREATE INDEX street_code ON address_point (street_code);"
  );
  await knex.schema.raw(
    `CREATE INDEX street_name ON street (name${
      isSqlite(knex) ? " COLLATE NOCASE" : ""
    });`
  );
  await knex.schema.raw(
    "CREATE INDEX street_sync_feed_url ON street_sync (feed_url);"
  );

  if (isPostgres(knex)) {
    await knex.schema.raw("CREATE EXTENSION IF NOT EXISTS CITEXT");
    await knex.schema.alterTable("street", (t) => {
      t.specificType("name", "CITEXT").notNullable().alter();
    });
  }
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists("school_location");
  await knex.schema.dropTableIfExists("address_point");
  await knex.schema.dropTableIfExists("founder");
  await knex.schema.dropTableIfExists("city_district");
  await knex.schema.dropTableIfExists("street");
  await knex.schema.dropTableIfExists("city");
  await knex.schema.dropTableIfExists("orp");
  await knex.schema.dropTableIfExists("county");
  await knex.schema.dropTableIfExists("region");
  await knex.schema.dropTableIfExists("school_founder");
  await knex.schema.dropTableIfExists("founder_type");
  await knex.schema.dropTableIfExists("meta");
  await knex.schema.dropTableIfExists("municipality_part");
  await knex.schema.dropTableIfExists("object_type");
  await knex.schema.dropTableIfExists("prague_district");
  await knex.schema.dropTableIfExists("school");
  await knex.schema.dropTableIfExists("street_sync");
}
