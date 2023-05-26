import fetch from "node-fetch";
import {
  createWriteStream,
  createReadStream,
  rmSync,
  readdirSync,
  existsSync,
} from "fs";
import { pipeline } from "stream/promises";
import { join } from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse";
import iconv from "iconv-lite";

import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsNotEmpty,
  prepareOptions,
  initDb,
} from "../utils/helpers";
import { commitAddressPoints, importParsedLine } from "../db/address-points";
import { getLatestUrlFromAtomFeed } from "../utils/atom";

const downloadAndUnzip = async (
  url: string,
  options: OpenDataSyncOptionsNotEmpty
): Promise<void> => {
  const zipFilePath = join(options.tmpDir, options.addressPointsZipFileName);

  console.log("Downloading a large ZIP file with RUIAN data (~65 MB)...");
  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error(
      `The ZIP file could not be downloaded. HTTP Code: ${response.status}`
    );
  }
  await pipeline(response.body, createWriteStream(zipFilePath));

  console.log("Finished downloading.");
  const zip = new AdmZip(zipFilePath);

  console.log(`Starting to unzip CSV files to '${options.tmpDir}'`);
  zip.extractAllTo(options.tmpDir, true);
  console.log("Unzip completed.");

  rmSync(zipFilePath);
  console.log("Removed the ZIP file.");
};

const importDataToDb = async (options: OpenDataSyncOptionsNotEmpty) => {
  const extractionFolder = getExtractionFolder(options);

  const files = readdirSync(extractionFolder);

  let total = 0;
  let next = 0;

  console.log(
    "Initiating import of RUIAN data to search DB (~3 million rows to be imported)."
  );

  initDb(options);

  for (const file of files) {
    const parseStream = parse({ delimiter: ";", fromLine: 2 }).on(
      "data",
      (data) => {
        total += importParsedLine(data);
        if (total - next >= 100000) {
          next += 100000;
          console.log(`Total imported rows: ${next}`);
        }
      }
    );

    await pipeline(
      createReadStream(join(extractionFolder, file)),
      iconv.decodeStream("win1250"),
      parseStream
    );
    total += commitAddressPoints();
  }

  console.log(`Import completed. Total imported rows: ${total}`);
};

const getExtractionFolder = (options: OpenDataSyncOptionsNotEmpty) =>
  join(options.tmpDir, options.addressPointsCsvFolderName);

export const downloadAndImportAllLatestAddressPoints = async (
  options: OpenDataSyncOptions = {}
): Promise<void> => {
  const completeOptions = prepareOptions(options);
  const datasetFeedLink = await getLatestUrlFromAtomFeed(
    completeOptions.addressPointsAtomUrl
  );
  const zipUrl = await getLatestUrlFromAtomFeed(datasetFeedLink);
  await downloadAndUnzip(zipUrl, completeOptions);
  await importDataToDb(completeOptions);
};

export const importAllLatestAddressPoints = async (
  options: OpenDataSyncOptions = {}
): Promise<void> => {
  const completeOptions = prepareOptions(options);
  await importDataToDb(completeOptions);
};

export const deleteDb = (options: OpenDataSyncOptions = {}) => {
  const completeOptions = prepareOptions(options);
  if (existsSync(completeOptions.dbFilePath)) {
    rmSync(completeOptions.dbFilePath);
  }
};
