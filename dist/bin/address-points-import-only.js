import { importAllLatestAddressPoints } from "../open-data-sync/address-points";
console.time("importOnly");
importAllLatestAddressPoints({})
    .then(() => {
    console.timeEnd("importOnly");
})
    .catch((error) => {
    if (error.hasOwnProperty("stack")) {
        console.log(error, error.stack);
    }
    else {
        console.log(error);
    }
});
