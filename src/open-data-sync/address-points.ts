import AdmZip from "adm-zip";
import { parse } from "csv-parse";
import { createReadStream, createWriteStream, readdirSync, rmSync } from "fs";
import iconv from "iconv-lite";
import fetch from "node-fetch";
import { join } from "path";
import { pipeline } from "stream/promises";
import chunk from "lodash/chunk";
import {
  commitAddressPoints,
  removeDeprecatedAddressPoints,
} from "../db/address-points";
import { SyncPart } from "../db/types";
import { getLatestUrlFromAtomFeed } from "../utils/atom";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsPartial,
  prepareOptions,
} from "../utils/helpers";
import { runSyncPart } from "./common";

const maxBufferSize = 1000;

const downloadAndUnzip = async (
  url: string,
  options: OpenDataSyncOptions
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

const importDataToDb = async (options: OpenDataSyncOptions) => {
  const extractionFolder = getExtractionFolder(options);

  const files = readdirSync(extractionFolder);

  let total = 0;
  let next = 0;

  console.log(
    "Initiating import of RUIAN data to search DB (~3 million rows to be imported)."
  );

  const allIds = new Set<number>();

  for (const [i, file] of files.entries()) {
    const rows: string[][] = [];
    const parseStream = parse({ delimiter: ";", fromLine: 2 }).on(
      "data",
      async (data) => {
        rows.push(data);
        allIds.add(parseInt(data[0]));
      }
    );

    await pipeline(
      createReadStream(join(extractionFolder, file)),
      iconv.decodeStream("win1250"),
      parseStream
    );

    const chunks = chunk(rows, maxBufferSize);

    await Promise.all(
      chunks.map(async (chunk) => {
        total += await commitAddressPoints(chunk);

        if (total - next >= 100000) {
          next += 100000;
          console.log(`Total imported rows: ${next}`);
        }
      })
    );

    console.log(`${i + 1}/${files.length} files imported.`);
  }

  await removeDeprecatedAddressPoints(allIds);

  console.log(`Import completed. Total imported rows: ${total}`);
};

const getExtractionFolder = (options: OpenDataSyncOptions) =>
  join(options.tmpDir, options.addressPointsCsvFolderName);

export const downloadAndImportAddressPoints = async (
  options: OpenDataSyncOptionsPartial = {}
): Promise<void> => {
  await runSyncPart(SyncPart.AddressPoints, [], async () => {
    const completeOptions = prepareOptions(options);
    const datasetFeedLink = await getLatestUrlFromAtomFeed(
      completeOptions.addressPointsAtomUrl
    );
    const zipUrl = await getLatestUrlFromAtomFeed(datasetFeedLink);
    // await downloadAndUnzip(zipUrl, completeOptions);
    await importDataToDb(completeOptions);
  });
};
