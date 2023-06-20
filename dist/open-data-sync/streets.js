var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fetch from "node-fetch";
import { createWriteStream, rmSync, existsSync, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import { join } from "path";
import AdmZip from "adm-zip";
import parseDBF from "parsedbf";
import { prepareOptions, initDb, } from "../utils/helpers";
import { deleteStreets, getAllSyncedStreets, insertStreetsFromDbf, setStreetAsSynced, } from "../db/street-sync";
import { getAllUrlsFromAtomFeed, getLatestUrlFromAtomFeed, } from "../utils/atom";
const prepareFolders = (options) => {
    const tempFolder = getTempFolder(options);
    if (!existsSync(tempFolder)) {
        mkdirSync(tempFolder);
    }
};
const getTempFolder = (options) => {
    return join(options.tmpDir, options.streetZipFolderName);
};
const downloadZipAndParseDbfFile = (url, index, options) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield fetch(url);
    if (response.status !== 200) {
        throw new Error(`The ZIP file from '${url}' could not be downloaded. HTTP Code: ${response.status}`);
    }
    const zipFilePath = join(getTempFolder(options), `street${index}.zip`);
    yield pipeline(response.body, createWriteStream(zipFilePath));
    const zip = new AdmZip(zipFilePath);
    const folderName = zip.getEntries()[0].entryName;
    const dbfEntryName = `${folderName}${options.streetDbfFileName}`;
    const obj = parseDBF(zip.getEntry(dbfEntryName).getData(), "win1250");
    rmSync(zipFilePath);
    return obj;
});
const importDataToDb = (data) => __awaiter(void 0, void 0, void 0, function* () {
    if (data.length === 0) {
        return;
    }
    insertStreetsFromDbf(data);
});
export const downloadAndImportStreets = (options) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Starting to download and import streets. This takes up to 1 hour.");
    const completeOptions = prepareOptions(options);
    initDb(completeOptions);
    prepareFolders(completeOptions);
    const allDatasetFeedLinks = yield getAllUrlsFromAtomFeed(completeOptions.streetsAtomUrl);
    console.log(`Total of ${allDatasetFeedLinks.length} links to ZIP files.`);
    const syncedStreetLinks = getAllSyncedStreets();
    const toDelete = [];
    // remove all deprecated links (not in the new list)
    syncedStreetLinks.forEach((link) => {
        if (!allDatasetFeedLinks.includes(link)) {
            toDelete.push(link);
            delete syncedStreetLinks[link];
        }
    });
    deleteStreets(toDelete);
    let done = syncedStreetLinks.size;
    console.log(`Total of ${done} links to ZIP files already stored.`);
    // get all links not yet stored
    const newLinks = allDatasetFeedLinks.filter((link) => !syncedStreetLinks.has(link));
    console.log(`Loading ${newLinks.length} new links to ZIP files.`);
    for (const link of newLinks) {
        const zipLink = yield getLatestUrlFromAtomFeed(link);
        const dbfObject = yield downloadZipAndParseDbfFile(zipLink, done, completeOptions);
        yield importDataToDb(dbfObject);
        setStreetAsSynced(link);
        done++;
        console.log(`Loaded links: ${done}/${allDatasetFeedLinks.length}`);
    }
});
