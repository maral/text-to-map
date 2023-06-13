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
import fetch from "node-fetch";
import { pipeline } from "stream/promises";
import { initDb, prepareOptions, } from "../utils/helpers";
import { insertRegionsAndOrps } from "../db/regions";
const downloadAndImportDataToDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Downloading regions and ORP data...");
    const response = yield fetch(options.regionsCsvUrl);
    if (response.status !== 200) {
        throw new Error(`The file could not be downloaded. HTTP Code: ${response.status}`);
    }
    console.log("Download completed. Starting to parse CSV file...");
    const rows = [];
    const parseStream = parse({ delimiter: ",", fromLine: 2 }).on("data", (data) => {
        rows.push(data);
    });
    yield pipeline(response.body, iconv.decodeStream("utf-8"), parseStream);
    const schemaResponse = yield fetch(options.regionsSchemaUrl);
    if (schemaResponse.status !== 200) {
        throw new Error(`The file could not be downloaded. HTTP Code: ${schemaResponse.status}`);
    }
    // @ts-ignore
    const schema = yield schemaResponse.json();
    console.log("Parsing completed. Starting to import data to DB...");
    initDb(options);
    insertRegionsAndOrps(rows, schema);
    console.log(`Import completed. Total imported rows: ${rows.length}`);
});
export const downloadAndImportRegions = (options = {}) => __awaiter(void 0, void 0, void 0, function* () {
    const completeOptions = prepareOptions(options);
    yield downloadAndImportDataToDb(completeOptions);
});
