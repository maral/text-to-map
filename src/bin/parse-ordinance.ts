import { readFileSync } from "fs";
import { setDbConfig } from "../db/db";
import { parseOrdinanceToAddressPoints } from "../street-markdown/smd";
import { prepareOptions } from "../utils/helpers";

// take first node argument as a file name
if (process.argv.length < 3) {
  console.error("Missing file name argument");
  process.exit(1);
}

const fileName = process.argv[2];
const fileContent = readFileSync(fileName);
const lines = fileContent.toString().split("\n");

const options = prepareOptions({});
setDbConfig({
  filePath: options.dbFilePath,
  initFilePath: options.dbInitFilePath,
});

const addressPoints = parseOrdinanceToAddressPoints(lines);

console.log(JSON.stringify(addressPoints));
