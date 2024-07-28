import { readFileSync, writeFileSync } from "fs";
import { municipalitiesToPolygons } from "../street-markdown/polygons";
import { disconnectKnex } from "../db/db";
import { Municipality } from "../street-markdown/types";

async function main() {
  // take first node argument as a file name
  if (process.argv.length < 3) {
    console.error("Missing file name argument");
    process.exit(1);
  }

  const fileName = process.argv[2];
  const fileContent = readFileSync(fileName);
  const json = JSON.parse(fileContent.toString()) as Municipality[];

  const municipalityPolygons = await municipalitiesToPolygons(json);

  console.log(`Processed ${json.length} municipalities`);
  await disconnectKnex();

  const output = JSON.stringify(municipalityPolygons);
  if (process.argv.length >= 4) {
    const outputFileName = process.argv[3];
    console.log(`Writing polygons to ${outputFileName}`);
    writeFileSync(outputFileName, output);
  } else {
    console.log(JSON.stringify(output));
  }
}

main();
