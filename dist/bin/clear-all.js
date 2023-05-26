import { deleteDb } from "../open-data-sync/address-points";
import { deleteSchoolsXmlFile } from "../open-data-sync/schools";
deleteDb();
deleteSchoolsXmlFile();
console.log("Everything cleared, ready for a new sync.");
