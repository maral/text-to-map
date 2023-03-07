import { importOnly } from "../open-data-sync/address-points";

console.time("importOnly");
importOnly({})
  .then(() => {
    console.timeEnd("importOnly");
  })
  .catch((error: any) => {
    if (error.hasOwnProperty("stack")) {
      console.log(error, error.stack);
    } else {
      console.log(error);
    }
  });
