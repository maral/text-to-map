import { downloadAndImportAllSchools } from "../open-data-sync/schools";

downloadAndImportAllSchools({})
  .then(() => {
    console.log("Completed");
  })
  .catch((error) => {
    console.log(error);
  });
