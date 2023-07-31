import { parse } from "csv-parse";
import iconv from "iconv-lite";
import fetch from "node-fetch";
import { pipeline } from "stream/promises";

import { RegionsTableSchema, insertRegionsAndOrps } from "../db/regions";
import { SyncPart } from "../db/types";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsPartial,
  prepareOptions,
} from "../utils/helpers";
import { runSyncPart } from "./common";
import { createReadStream } from "fs";
import { insertCityPositions } from "../db/cities";

const importDataToDb = async (options: OpenDataSyncOptions) => {
  console.log("Starting to parse CSV file...");

  // source: https://github.com/33bcdd/souradnice-mest/blob/master/souradnice.csv
  const csvStream = createReadStream("./data/souradnice.csv");

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
