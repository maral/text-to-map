import { readFileSync, writeFileSync } from "fs";
import {
  getNewMunicipalityByName,
  parseOrdinanceToAddressPoints,
} from "../street-markdown/smd";
import { ErrorCallbackParams } from "../street-markdown/types";
import { municipalityToPolygons } from "../street-markdown/polygons";
import { disconnectKnex } from "../db/db";

async function main() {
  // take first node argument as a file name
  if (process.argv.length < 3) {
    console.error("Missing file name argument");
    process.exit(1);
  }

  const fileName = process.argv[2];
  const fileContent = readFileSync(fileName);
  const lines = fileContent.toString().split("\n");

  let errorCount = 0;
  const errorLines: string[] = [];
  let warningCount = 0;

  const reportErrors = ({
    lineNumber,
    line,
    errors,
  }: ErrorCallbackParams): void => {
    errors.forEach((error) => console.error(error));
    console.error(`Invalid street definition on line ${lineNumber}: ${line}`);
    errorCount++;
    errorLines.push(`line ${lineNumber}: ${line}`);
  };

  const reportWarnings = ({
    lineNumber,
    errors: warnings,
  }: ErrorCallbackParams): void => {
    warnings.forEach((error) => {
      console.error(`Line ${lineNumber}: ${error.message}`);
    });
    warningCount++;
  };

  console.time("downloadAndImportAllLatestAddressPoints");

  // const { municipality } = await getNewMunicipalityByName("Česká Lípa");

  const addressPoints = await parseOrdinanceToAddressPoints({
    lines,
    initialState: {
      // currentMunicipality: municipality,
    },
    onError: reportErrors,
    onWarning: reportWarnings,
    includeUnmappedAddressPoints: true,
  });
  console.timeEnd("downloadAndImportAllLatestAddressPoints");

  const polygons = [];
  for (const municipality of addressPoints) {
    polygons.push(await municipalityToPolygons(municipality));
  }

  await disconnectKnex();

  console.log(
    `Parsed ${lines.length} lines, ${errorCount} errors, ${warningCount} warnings.`
  );
  if (errorCount > 0) {
    console.log("Errors:");
    errorLines.forEach((line) => console.log(line));
  }

  if (process.argv.length >= 4) {
    const outputFileName = process.argv[3];
    const output = JSON.stringify(addressPoints);
    console.log(`Writing output to ${outputFileName}`);
    writeFileSync(outputFileName, output);
  } else {
    console.log(JSON.stringify(addressPoints));
  }

  if (process.argv.length >= 5) {
    const outputFileName = process.argv[4];
    const output = JSON.stringify(polygons);
    console.log(`Writing polygons to ${outputFileName}`);
    writeFileSync(outputFileName, output);
  }
}

main();
