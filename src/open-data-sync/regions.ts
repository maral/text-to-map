import { parse } from "csv-parse";
import iconv from "iconv-lite";
import fetch from "node-fetch";
import { pipeline } from "stream/promises";

import { RegionsTableSchema, insertRegionsAndOrps } from "../db/regions";
import { SyncPart } from "../db/types";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsPartial,
  prepareOptions
} from "../utils/helpers";
import { runSyncPart } from "./common";

const downloadAndImportDataToDb = async (
  options: OpenDataSyncOptions
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

  await insertRegionsAndOrps(rows, schema);

  console.log(`Import completed. Total imported rows: ${rows.length}`);
};

export const downloadAndImportRegions = async (
  options: OpenDataSyncOptionsPartial = {}
): Promise<void> => {
  await runSyncPart(SyncPart.Regions, [], async () => {
    const completeOptions = prepareOptions(options);
    await downloadAndImportDataToDb(completeOptions);
  });
};
