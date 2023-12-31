import { readFileSync, writeFileSync } from "fs";
import { municipalityToPolygons } from "../street-markdown/polygons";

// take first node argument as a file name
if (process.argv.length < 3) {
  console.error("Missing file name argument");
  process.exit(1);
}

const fileName = process.argv[2];
const fileContent = readFileSync(fileName);
const json = JSON.parse(fileContent.toString());
const municipalityPolygons = municipalityToPolygons(json[0]);

const output = JSON.stringify(municipalityPolygons);
if (process.argv.length >= 4) {
  const outputFileName = process.argv[3];
  console.log(`Writing polygons to ${outputFileName}`);
  writeFileSync(outputFileName, output);
} else {
  console.log(JSON.stringify(output));
}
