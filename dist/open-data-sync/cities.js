var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { parse } from "csv-parse";
import iconv from "iconv-lite";
import { pipeline } from "stream/promises";
import { SyncPart } from "../db/types";
import { prepareOptions, } from "../utils/helpers";
import { runSyncPart } from "./common";
import { createReadStream } from "fs";
import { insertCityPositions } from "../db/cities";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const importDataToDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Starting to parse CSV file...");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // source: https://github.com/33bcdd/souradnice-mest/blob/master/souradnice.csv
    const csvStream = createReadStream(join(__dirname, "..", "souradnice.csv"));
    const rows = [];
    const parseStream = parse({ delimiter: ",", fromLine: 2 }).on("data", (data) => {
        rows.push(data);
    });
    yield pipeline(csvStream, iconv.decodeStream("utf-8"), parseStream);
    console.log("Parsing completed. Starting to import data to DB...");
    yield insertCityPositions(rows);
    console.log(`Import completed. Total imported rows: ${rows.length}`);
});
export const importCities = (options = {}) => __awaiter(void 0, void 0, void 0, function* () {
    yield runSyncPart(SyncPart.Regions, [], () => __awaiter(void 0, void 0, void 0, function* () {
        const completeOptions = prepareOptions(options);
        yield importDataToDb(completeOptions);
    }));
});
