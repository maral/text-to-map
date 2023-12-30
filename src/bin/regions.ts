import { downloadAndImportRegions } from "../open-data-sync/regions";
import { defaultBinOptions } from "./constants";

downloadAndImportRegions(defaultBinOptions)
  .then(() => {
    console.log("Completed");
  })
  .catch((error) => {
    console.log(error);
  });
