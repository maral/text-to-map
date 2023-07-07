import { readFileSync, writeFileSync } from "fs";
import {
  getNewMunicipality,
  parseOrdinanceToAddressPoints,
} from "../street-markdown/smd";
import { ErrorCallbackParams } from "../street-markdown/types";

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

  const { municipality } = await getNewMunicipality("Česká Lípa");

  const addressPoints = await parseOrdinanceToAddressPoints(
    lines,
    {
      // currentMunicipality: municipality,
    },
    reportErrors,
    reportWarnings
  );
  console.timeEnd("downloadAndImportAllLatestAddressPoints");

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
}

main();
