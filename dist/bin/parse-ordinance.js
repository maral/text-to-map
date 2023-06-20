import { readFileSync, writeFileSync } from "fs";
import { getNewMunicipality, parseOrdinanceToAddressPoints } from "../street-markdown/smd";
import { defaultBinOptions } from "./constants";
// take first node argument as a file name
if (process.argv.length < 3) {
    console.error("Missing file name argument");
    process.exit(1);
}
const fileName = process.argv[2];
const fileContent = readFileSync(fileName);
const lines = fileContent.toString().split("\n");
let errorCount = 0;
const errorLines = [];
let warningCount = 0;
const reportErrors = ({ lineNumber, line, errors, }) => {
    errors.forEach(console.error);
    console.error(`Invalid street definition on line ${lineNumber}: ${line}`);
    errorCount++;
    errorLines.push(`line ${lineNumber}: ${line}`);
};
const reportWarnings = ({ lineNumber, errors: warnings, }) => {
    warnings.map((error) => {
        console.error(`Line ${lineNumber}: ${error}`);
    });
    warningCount++;
};
console.time("downloadAndImportAllLatestAddressPoints");
const addressPoints = parseOrdinanceToAddressPoints(lines, defaultBinOptions, {
    currentMunicipality: getNewMunicipality("Česká Lípa", defaultBinOptions),
}, reportErrors, reportWarnings);
console.timeEnd("downloadAndImportAllLatestAddressPoints");
console.log(`Parsed ${lines.length} lines, ${errorCount} errors, ${warningCount} warnings.`);
if (errorCount > 0) {
    console.log("Errors:");
    errorLines.forEach((line) => console.log(line));
}
if (process.argv.length >= 4) {
    const outputFileName = process.argv[3];
    const output = JSON.stringify(addressPoints);
    console.log(`Writing output to ${outputFileName}`);
    writeFileSync(outputFileName, output);
}
else {
    console.log(JSON.stringify(addressPoints));
}
