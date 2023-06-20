import { downloadAndImportAddressPoints } from "../open-data-sync/address-points";
import { defaultBinOptions } from "./constants";
console.time("downloadAndImportAllLatestAddressPoints");
downloadAndImportAddressPoints(defaultBinOptions)
    .then(() => {
    console.timeEnd("downloadAndImportAllLatestAddressPoints");
})
    .catch((error) => {
    if (error.hasOwnProperty("stack")) {
        console.log(error, error.stack);
    }
    else {
        console.log(error);
    }
});
