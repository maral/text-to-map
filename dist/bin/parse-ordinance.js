var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { readFileSync, writeFileSync } from "fs";
import { getNewMunicipalityByName, parseOrdinanceToAddressPoints, } from "../street-markdown/smd";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
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
            errors.forEach((error) => console.error(error));
            console.error(`Invalid street definition on line ${lineNumber}: ${line}`);
            errorCount++;
            errorLines.push(`line ${lineNumber}: ${line}`);
        };
        const reportWarnings = ({ lineNumber, errors: warnings, }) => {
            warnings.forEach((error) => {
                console.error(`Line ${lineNumber}: ${error.message}`);
            });
            warningCount++;
        };
        console.time("downloadAndImportAllLatestAddressPoints");
        const { municipality } = yield getNewMunicipalityByName("Česká Lípa");
        const addressPoints = yield parseOrdinanceToAddressPoints(lines, {
        // currentMunicipality: municipality,
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
    });
}
main();
