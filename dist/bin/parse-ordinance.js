import { readFileSync, writeFileSync } from "fs";
import { parseOrdinanceToAddressPoints } from "../street-markdown/smd";
// take first node argument as a file name
if (process.argv.length < 3) {
    console.error("Missing file name argument");
    process.exit(1);
}
const fileName = process.argv[2];
const fileContent = readFileSync(fileName);
const lines = fileContent.toString().split("\n");
const addressPoints = parseOrdinanceToAddressPoints(lines);
if (process.argv.length >= 4) {
    const outputFileName = process.argv[3];
    const output = JSON.stringify(addressPoints);
    console.log(`Writing output to ${outputFileName}`);
    writeFileSync(outputFileName, output);
}
else {
    console.log(JSON.stringify(addressPoints));
}
