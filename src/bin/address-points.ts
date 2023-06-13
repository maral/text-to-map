import { downloadAndImportAddressPoints } from "../open-data-sync/address-points";

console.time("downloadAndImportAllLatestAddressPoints");
downloadAndImportAddressPoints({ dataDir: "./tmp/db" })
  .then(() => {
    console.timeEnd("downloadAndImportAllLatestAddressPoints");
  })
  .catch((error: any) => {
    if (error.hasOwnProperty("stack")) {
      console.log(error, error.stack);
    } else {
      console.log(error);
    }
  });
