import { downloadAndImportSchools } from "../open-data-sync/schools";
downloadAndImportSchools({ dataDir: "./tmp/db" })
    .then(() => {
    console.log("Completed");
})
    .catch((error) => {
    console.log(error);
});
