import parseDBF from "parsedbf";
import { readFileSync } from "fs";

const filePath = "tmp/UL_L.dbf";

var parsedDBF = parseDBF(readFileSync(filePath), "win1250");

console.log(parsedDBF);
