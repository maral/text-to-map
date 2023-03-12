import { districtsToCsvRules } from "./json-to-csv.js";
import { getParsedDistricts } from "./txt-to-json.js";

const main = async () => {
  const districts = await getParsedDistricts("vyhlaskaP10.txt");
  districtsToCsvRules(districts);
};

main();
