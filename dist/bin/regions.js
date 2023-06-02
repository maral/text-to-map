import { downloadAndImportRegions } from "../open-data-sync/regions";
downloadAndImportRegions()
    .then(() => {
    console.log("Completed");
})
    .catch((error) => {
    console.log(error);
});
