import { downloadAndImportSchools } from "../open-data-sync/schools";
import { defaultBinOptions } from "./constants";
downloadAndImportSchools(defaultBinOptions)
    .then(() => {
    console.log("Completed");
})
    .catch((error) => {
    console.log(error);
});
