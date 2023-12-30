import { downloadAndImportStreets } from "../open-data-sync/streets";
import { defaultBinOptions } from "./constants";
console.time("downloadAndImportAllStreets");
downloadAndImportStreets(defaultBinOptions)
    .then(() => {
    console.timeEnd("downloadAndImportAllStreets");
})
    .catch((error) => {
    if (error.hasOwnProperty("stack")) {
        console.log(error, error.stack);
    }
    else {
        console.log(error);
    }
});
