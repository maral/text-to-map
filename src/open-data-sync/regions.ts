import { parse } from "csv-parse";
import iconv from "iconv-lite";
import fetch from "node-fetch";
import { pipeline } from "stream/promises";

import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsNotEmpty,
  initDb,
  prepareOptions,
} from "../utils/helpers";
import { RegionsTableSchema, insertRegionsAndOrps } from "../db/regions";

const downloadAndImportDataToDb = async (
  options: OpenDataSyncOptionsNotEmpty
) => {
  console.log("Downloading regions and ORP data...");
  const response = await fetch(options.regionsCsvUrl);
  if (response.status !== 200) {
    throw new Error(
      `The file could not be downloaded. HTTP Code: ${response.status}`
    );
  }


  console.log("Download completed. Starting to parse CSV file...");

  const rows: string[][] = [];
  const parseStream = parse({ delimiter: ",", fromLine: 2 }).on(
    "data",
    (data: string[]) => {
      rows.push(data);
    }
  );

  await pipeline(response.body, iconv.decodeStream("utf-8"), parseStream);
  
  const schemaResponse = await fetch(options.regionsSchemaUrl);
  if (schemaResponse.status !== 200) {
    throw new Error(
      `The file could not be downloaded. HTTP Code: ${schemaResponse.status}`
    );
  }
  // @ts-ignore
  const schema: RegionsTableSchema = await schemaResponse.json();

  console.log("Parsing completed. Starting to import data to DB...");

  initDb(options);
  insertRegionsAndOrps(rows, schema);

  console.log(`Import completed. Total imported rows: ${rows.length}`);
};

export const downloadAndImportRegions = async (
  options: OpenDataSyncOptions = {}
): Promise<void> => {
  const completeOptions = prepareOptions(options);
  await downloadAndImportDataToDb(completeOptions);
};
