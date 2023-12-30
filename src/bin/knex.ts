import { disconnectKnex, getKnexDb } from "../db/db";

async function main() {
  const knex = getKnexDb();
  await knex.schema.alterTable("school_founder", (table) => {
    table.unique(["school_izo", "founder_id"]);
  });
  await disconnectKnex();
}

main();
