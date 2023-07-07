var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import AdmZip from "adm-zip";
import { parse } from "csv-parse";
import { createReadStream, createWriteStream, readdirSync, rmSync } from "fs";
import iconv from "iconv-lite";
import fetch from "node-fetch";
import { join } from "path";
import { pipeline } from "stream/promises";
import { commitAddressPoints } from "../db/address-points";
import { SyncPart } from "../db/types";
import { getLatestUrlFromAtomFeed } from "../utils/atom";
import { prepareOptions, } from "../utils/helpers";
import { runSyncPart } from "./common";
const maxBufferSize = 1000;
const downloadAndUnzip = (url, options) => __awaiter(void 0, void 0, void 0, function* () {
    const zipFilePath = join(options.tmpDir, options.addressPointsZipFileName);
    console.log("Downloading a large ZIP file with RUIAN data (~65 MB)...");
    const response = yield fetch(url);
    if (response.status !== 200) {
        throw new Error(`The ZIP file could not be downloaded. HTTP Code: ${response.status}`);
    }
    yield pipeline(response.body, createWriteStream(zipFilePath));
    console.log("Finished downloading.");
    const zip = new AdmZip(zipFilePath);
    console.log(`Starting to unzip CSV files to '${options.tmpDir}'`);
    zip.extractAllTo(options.tmpDir, true);
    console.log("Unzip completed.");
    rmSync(zipFilePath);
    console.log("Removed the ZIP file.");
});
const importDataToDb = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const extractionFolder = getExtractionFolder(options);
    const files = readdirSync(extractionFolder);
    let total = 0;
    let next = 0;
    console.log("Initiating import of RUIAN data to search DB (~3 million rows to be imported).");
    const buffer = [];
    for (const file of files) {
        const parseStream = parse({ delimiter: ";", fromLine: 2 }).on("data", (data) => __awaiter(void 0, void 0, void 0, function* () {
            buffer.push(data);
            if (buffer.length >= maxBufferSize) {
                parseStream.pause();
                total += yield commitAddressPoints(buffer);
                if (total - next >= 100000) {
                    next += 100000;
                    console.log(`Total imported rows: ${next}`);
                }
                buffer.length = 0;
                parseStream.resume();
            }
        }));
        yield pipeline(createReadStream(join(extractionFolder, file)), iconv.decodeStream("win1250"), parseStream);
    }
    total += yield commitAddressPoints(buffer);
    console.log(`Import completed. Total imported rows: ${total}`);
});
const getExtractionFolder = (options) => join(options.tmpDir, options.addressPointsCsvFolderName);
export const downloadAndImportAddressPoints = (options = {}) => __awaiter(void 0, void 0, void 0, function* () {
    yield runSyncPart(SyncPart.AddressPoints, [], () => __awaiter(void 0, void 0, void 0, function* () {
        const completeOptions = prepareOptions(options);
        const datasetFeedLink = yield getLatestUrlFromAtomFeed(completeOptions.addressPointsAtomUrl);
        const zipUrl = yield getLatestUrlFromAtomFeed(datasetFeedLink);
        yield downloadAndUnzip(zipUrl, completeOptions);
        yield importDataToDb(completeOptions);
    }));
});
