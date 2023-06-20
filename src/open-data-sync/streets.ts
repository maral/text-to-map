import fetch from "node-fetch";
import { createWriteStream, rmSync, existsSync, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import { join } from "path";
import AdmZip from "adm-zip";
import parseDBF from "parsedbf";

import {
  OpenDataSyncOptionsPartial,
  OpenDataSyncOptions,
  prepareOptions,
  initDb,
} from "../utils/helpers";
import {
  deleteStreets,
  getAllSyncedStreets,
  insertStreetsFromDbf,
  setStreetAsSynced,
} from "../db/street-sync";
import { DbfStreet } from "../db/types";
import {
  getAllUrlsFromAtomFeed,
  getLatestUrlFromAtomFeed,
} from "../utils/atom";

const prepareFolders = (options: OpenDataSyncOptions) => {
  const tempFolder = getTempFolder(options);
  if (!existsSync(tempFolder)) {
    mkdirSync(tempFolder);
  }
};

const getTempFolder = (options: OpenDataSyncOptions) => {
  return join(options.tmpDir, options.streetZipFolderName);
};

const downloadZipAndParseDbfFile = async (
  url: string,
  index: number,
  options: OpenDataSyncOptions
): Promise<DbfStreet[]> => {
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(
      `The ZIP file from '${url}' could not be downloaded. HTTP Code: ${response.status}`
    );
  }
  const zipFilePath = join(getTempFolder(options), `street${index}.zip`);
  await pipeline(response.body, createWriteStream(zipFilePath));

  const zip = new AdmZip(zipFilePath);
  const folderName = zip.getEntries()[0].entryName;
  const dbfEntryName = `${folderName}${options.streetDbfFileName}`;
  const obj = parseDBF(zip.getEntry(dbfEntryName).getData(), "win1250");

  rmSync(zipFilePath);
  return obj;
};

const importDataToDb = async (data: DbfStreet[]) => {
  if (data.length === 0) {
    return;
  }
  insertStreetsFromDbf(data);
};

export const downloadAndImportStreets = async (
  options: OpenDataSyncOptionsPartial
): Promise<void> => {

  console.log("Starting to download and import streets. This takes up to 1 hour.");

  const completeOptions = prepareOptions(options);
  initDb(completeOptions);
  prepareFolders(completeOptions);

  const allDatasetFeedLinks = await getAllUrlsFromAtomFeed(
    completeOptions.streetsAtomUrl
  );

  console.log(`Total of ${allDatasetFeedLinks.length} links to ZIP files.`);

  const syncedStreetLinks = getAllSyncedStreets();

  const toDelete: string[] = [];
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
  const newLinks = allDatasetFeedLinks.filter(
    (link) => !syncedStreetLinks.has(link)
  );

  console.log(`Loading ${newLinks.length} new links to ZIP files.`);
  for (const link of newLinks) {
    const zipLink = await getLatestUrlFromAtomFeed(link);
    const dbfObject = await downloadZipAndParseDbfFile(
      zipLink,
      done,
      completeOptions
    );
    await importDataToDb(dbfObject);
    setStreetAsSynced(link);

    done++;
    console.log(`Loaded links: ${done}/${allDatasetFeedLinks.length}`);
  }
};
