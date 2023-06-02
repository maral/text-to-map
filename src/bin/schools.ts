import { downloadAndImportSchools } from "../open-data-sync/schools";

downloadAndImportSchools({ tmpDir: "tmp" })
  .then(() => {
    console.log("Completed");
  })
  .catch((error) => {
    console.log(error);
  });
