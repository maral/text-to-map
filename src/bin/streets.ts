import { downloadAndImportAllStreets } from "../open-data-sync/streets";

console.time("downloadAndImportAllStreets");
downloadAndImportAllStreets({})
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
