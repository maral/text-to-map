import FeedParser from "feedparser";
import fetch from "node-fetch";
import { createWriteStream, createReadStream, rmSync, readdirSync } from "fs";
import { pipeline } from "stream/promises";
import { join } from "path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse";
import iconv from "iconv-lite";

import {
  commitAddressPoints,
  importParsedLine,
  setDbConfig,
} from "./search-db";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsNotEmpty,
  prepareOptions,
} from "../utils/helpers";

const getLatestUrlFromAtomFeed = async (
  atomFeedUrl: string
): Promise<string> => {
  const response = await fetch(atomFeedUrl);
  const feedparser = new FeedParser({});
  let link = null;

  if (response.status !== 200) {
    throw new Error(
      `The Atom feed from atom.cuzk.cz not working. HTTP status ${response.status}`
    );
  }

  feedparser.on("error", (error) => {
    throw new Error(`The Atom feed from atom.cuzk.cz could not be loaded.`);
  });

  feedparser.on("readable", function () {
    let item: FeedParser.Item;

    let maxDate = new Date();
    maxDate.setFullYear(1990);
    while ((item = this.read())) {
      if (item.date > maxDate) {
        maxDate = item.date;
        link = item.link;
      }
    }
  });

  await pipeline(response.body, feedparser);

  if (link != null) {
    return link;
  } else {
    throw new Error("Could not find any dataset feed link.");
  }
};

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

  setDbConfig({
    filePath: options.dbFilePath,
    initFilePath: options.dbInitFilePath,
  });

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
  options: OpenDataSyncOptions
): Promise<void> => {
  const completeOptions = prepareOptions(options);
  const datasetFeedLink = await getLatestUrlFromAtomFeed(
    completeOptions.addressPointsAtomUrl
  );
  const zipUrl = await getLatestUrlFromAtomFeed(datasetFeedLink);
  await downloadAndUnzip(zipUrl, completeOptions);
  await importDataToDb(completeOptions);
};

export const importOnly = async (
  options: OpenDataSyncOptions
): Promise<void> => {
  const completeOptions = prepareOptions(options);
  await importDataToDb(completeOptions);
};
