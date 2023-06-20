import { downloadAndImportSchools } from "../open-data-sync/schools";
import { defaultBinOptions } from "./constants";

downloadAndImportSchools(defaultBinOptions, true)
  .then(() => {
    console.log("Completed");
  })
  .catch((error) => {
    console.log(error);
  });
