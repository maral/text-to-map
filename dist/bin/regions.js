import { downloadAndImportRegions } from "../open-data-sync/regions";
downloadAndImportRegions({ dataDir: "./tmp/db" })
    .then(() => {
    console.log("Completed");
})
    .catch((error) => {
    console.log(error);
});
