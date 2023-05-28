import { downloadAndImportRegions } from "../open-data-sync/regions";

downloadAndImportRegions({ tmpDir: "tmp" })
  .then(() => {
    console.log("Completed");
  })
  .catch((error) => {
    console.log(error);
  });
