var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { districtsToCsvRules } from "./json-to-csv.js";
import { getParsedDistricts } from "./txt-to-json.js";
import { writeFileSync } from "fs";
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    // take first node argument as a file name
    if (process.argv.length < 3) {
        console.error("Missing file name argument");
        process.exit(1);
    }
    const fileName = process.argv[2];
    const districts = yield getParsedDistricts(fileName);
    const csv = districtsToCsvRules(districts);
    if (process.argv.length >= 4) {
        const outputFileName = process.argv[3];
        console.log(`Writing output to ${outputFileName}`);
        writeFileSync(outputFileName, csv);
    }
    else {
        console.log(csv);
    }
});
main();
