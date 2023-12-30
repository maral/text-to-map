import { disconnectKnex, initDb } from "../db/db";

async function main() {
  await initDb();
  console.log("Database ready to use.");
  await disconnectKnex();
}

main();
