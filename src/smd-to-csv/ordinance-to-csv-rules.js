import { districtsToCsvRules } from "./json-to-csv.js";
import { getParsedDistricts } from "./txt-to-json.js";

import { writeFileSync } from "fs";

const main = async () => {
  // take first node argument as a file name
  if (process.argv.length < 3) {
    console.error("Missing file name argument");
    process.exit(1);
  }

  const fileName = process.argv[2];

  const districts = await getParsedDistricts(fileName);
  const csv = districtsToCsvRules(districts);

  if (process.argv.length >= 4) {
    const outputFileName = process.argv[3];
    console.log(`Writing output to ${outputFileName}`);
    writeFileSync(outputFileName, csv);
  } else {
    console.log(csv);
  }
};

main();
