import { downloadAndImportStreets } from "../open-data-sync/streets";
import { defaultBinOptions } from "./constants";

// Parse command line arguments
const args = process.argv.slice(2);
const noCache = args.includes('--no-cache');

console.time("downloadAndImportAllStreets");
downloadAndImportStreets(defaultBinOptions, noCache)
  .then(() => {
    console.timeEnd("downloadAndImportAllStreets");
  })
  .catch((error: any) => {
    if (error.hasOwnProperty("stack")) {
      console.log(error, error.stack);
    } else {
      console.log(error);
    }
  });
