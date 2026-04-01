import { clearDb, disconnectKnex } from "../db/db";
import { deleteSchoolsJsonldFile } from "../open-data-sync/schools";
import { defaultBinOptions } from "./constants";

async function main() {
  console.log("Clearing all data...");
  await clearDb();
  console.log("DB cleared. Now deleting schools XML file...");
  deleteSchoolsJsonldFile(defaultBinOptions);
  await disconnectKnex();
  console.log("Everything cleared, ready for a new sync.");
}

main();
