import { deleteDb } from "../open-data-sync/address-points";
import { deleteSchoolsXmlFile } from "../open-data-sync/schools";
import { defaultBinOptions } from "./constants";

deleteDb(defaultBinOptions);
deleteSchoolsXmlFile(defaultBinOptions);
console.log("Everything cleared, ready for a new sync.");
