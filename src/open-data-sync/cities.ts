import { parse } from "csv-parse";
import iconv from "iconv-lite";
import { pipeline } from "stream/promises";

import { createReadStream } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { insertCityPositions } from "../db/cities";
import { SyncPart } from "../db/types";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsPartial,
  prepareOptions,
} from "../utils/helpers";
import { runSyncPart } from "./common";

const importDataToDb = async (options: OpenDataSyncOptions) => {
  console.log("Starting to parse CSV file...");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // source: https://github.com/33bcdd/souradnice-mest/blob/master/souradnice.csv
  const csvStream = createReadStream(join(__dirname, "..", "souradnice.csv"));

  const rows: string[][] = [];
  const parseStream = parse({ delimiter: ",", fromLine: 2 }).on(
    "data",
    (data: string[]) => {
      rows.push(data);
    }
  );

  await pipeline(csvStream, iconv.decodeStream("utf-8"), parseStream);

  console.log("Parsing completed. Starting to import data to DB...");

  await insertCityPositions(rows);

  console.log(`Import completed. Total imported rows: ${rows.length}`);
};

export const importCities = async (
  options: OpenDataSyncOptionsPartial = {}
): Promise<void> => {
  await runSyncPart(SyncPart.Regions, [], async () => {
    const completeOptions = prepareOptions(options);
    await importDataToDb(completeOptions);
  });
};
