import { downloadAndImportAllSchools } from "../open-data-sync/schools";

downloadAndImportAllSchools({ tmpDir: "tmp" })
  .then(() => {
    console.log("Completed");
  })
  .catch((error) => {
    console.log(error);
  });
