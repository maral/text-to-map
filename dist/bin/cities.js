import { importCities } from "../open-data-sync/cities";
import { defaultBinOptions } from "./constants";
importCities(defaultBinOptions)
    .then(() => {
    console.log("Completed");
})
    .catch((error) => {
    console.log(error);
});
