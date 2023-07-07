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
import { createWriteStream, existsSync, mkdirSync, rmSync } from "fs";
import fetch from "node-fetch";
import parseDBF from "parsedbf";
import { join } from "path";
import { pipeline } from "stream/promises";
import { deleteStreets, getAllSyncedStreets, insertStreetsFromDbf, setStreetAsSynced, } from "../db/street-sync";
import { SyncPart } from "../db/types";
import { getAllUrlsFromAtomFeed, getLatestUrlFromAtomFeed, } from "../utils/atom";
import { prepareOptions, } from "../utils/helpers";
import { runSyncPart } from "./common";
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
    yield insertStreetsFromDbf(data);
});
export const downloadAndImportStreets = (options = {}) => __awaiter(void 0, void 0, void 0, function* () {
    yield runSyncPart(SyncPart.Streets, [SyncPart.AddressPoints], () => __awaiter(void 0, void 0, void 0, function* () {
        console.log("Starting to download and import streets. This takes up to 1 hour.");
        const completeOptions = prepareOptions(options);
        prepareFolders(completeOptions);
        const allDatasetFeedLinks = yield getAllUrlsFromAtomFeed(completeOptions.streetsAtomUrl);
        console.log(`Total of ${allDatasetFeedLinks.length} links to ZIP files.`);
        const syncedStreetLinks = yield getAllSyncedStreets();
        const toDelete = [];
        // remove all deprecated links (not in the new list)
        syncedStreetLinks.forEach((link) => {
            if (!allDatasetFeedLinks.includes(link)) {
                toDelete.push(link);
                delete syncedStreetLinks[link];
            }
        });
        yield deleteStreets(toDelete);
        let done = syncedStreetLinks.size;
        console.log(`Total of ${done} links to ZIP files already stored.`);
        // get all links not yet stored
        const newLinks = allDatasetFeedLinks.filter((link) => !syncedStreetLinks.has(link));
        console.log(`Loading ${newLinks.length} new links to ZIP files.`);
        for (const link of newLinks) {
            const zipLink = yield getLatestUrlFromAtomFeed(link);
            const dbfObject = yield downloadZipAndParseDbfFile(zipLink, done, completeOptions);
            yield importDataToDb(dbfObject);
            yield setStreetAsSynced(link);
            done++;
            console.log(`Loaded links: ${done}/${allDatasetFeedLinks.length}`);
        }
    }));
});
