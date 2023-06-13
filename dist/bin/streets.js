import { downloadAndImportStreets } from "../open-data-sync/streets";
console.time("downloadAndImportAllStreets");
downloadAndImportStreets({ dataDir: "./tmp/db" })
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
