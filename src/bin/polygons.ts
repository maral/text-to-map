import { readFileSync, writeFileSync } from "fs";
import { setDbConfig } from "../db/db";
import { parseOrdinanceToAddressPoints } from "../street-markdown/smd";
import { prepareOptions } from "../utils/helpers";
import { municipalityToPolygons } from "../street-markdown/polygons";
import { Municipality } from "../street-markdown/types";

// take first node argument as a file name
if (process.argv.length < 3) {
  console.error("Missing file name argument");
  process.exit(1);
}

const fileName = process.argv[2];
const fileContent = readFileSync(fileName);
const json = JSON.parse(fileContent.toString());
const municipalityPolygons = json.map((municipality: Municipality) =>
  municipalityToPolygons(municipality)
);
const output = JSON.stringify(municipalityPolygons);

if (process.argv.length >= 4) {
  const outputFileName = process.argv[3];
  console.log(`Writing output to ${outputFileName}`);
  writeFileSync(outputFileName, output);
} else {
  console.log(JSON.stringify(output));
}
