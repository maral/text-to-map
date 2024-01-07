import AdmZip from "adm-zip";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "fs";
import fetch from "node-fetch";
import parseDBF from "parsedbf";
import ShpToGeoJson from "shp-to-geojson";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Buffer } from "buffer";

import {
  deleteStreets,
  getAllSyncedStreets,
  insertStreetsFromDbf,
  setStreetAsSynced,
} from "../db/street-sync";
import { DbfStreet, SyncPart } from "../db/types";
import {
  getAllUrlsFromAtomFeed,
  getLatestUrlFromAtomFeed,
} from "../utils/atom";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsPartial,
  prepareOptions,
} from "../utils/helpers";
import { runSyncPart } from "./common";
import { coordEach } from "@turf/meta";
import jtsk2wgs84 from "../utils/jtsk2wgs84";
import { FeatureCollection } from "@turf/helpers";
import { setCityPolygonGeojson } from "../db/cities";

const prepareFolders = (options: OpenDataSyncOptions) => {
  const tempFolder = getTempFolder(options);
  if (!existsSync(tempFolder)) {
    mkdirSync(tempFolder);
  }
};

const getTempFolder = (options: OpenDataSyncOptions) => {
  return join(options.tmpDir, options.streetZipFolderName);
};

const downloadZipAndParseFiles = async (
  url: string,
  index: number,
  options: OpenDataSyncOptions
): Promise<{
  streetData: DbfStreet[];
  polygonData: FeatureCollection;
  cityCode: string;
}> => {
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
  const cityCode = folderName.substring(0, 6);
  const dbfEntryName = `${folderName}${options.streetDbfFileName}`;
  const streetData = parseDBF(zip.getEntry(dbfEntryName).getData(), "win1250");

  const shpEntryName = `${folderName}${options.polygonShpFileName}`;
  const polygonData = convertShpToGeoJson(zip.getEntry(shpEntryName).getData());

  rmSync(zipFilePath);
  return { streetData, polygonData, cityCode };
};

const convertShpToGeoJson = (shpBuffer: Buffer): FeatureCollection => {
  const shp = new ShpToGeoJson({
    arraybuffers: {
      shpBuffer,
    },
  });
  const geoJson = shp.getGeoJson();
  delete geoJson.bbox;

  coordEach(geoJson, (currentCoord) => {
    const [y, x] = currentCoord;
    const { lat, lon } = jtsk2wgs84(-x, -y);
    currentCoord[0] = lon;
    currentCoord[1] = lat;
  });

  return geoJson;
};

const importDataToDb = async ({
  streetData,
  polygonData,
  cityCode,
}: {
  streetData: DbfStreet[];
  polygonData: FeatureCollection;
  cityCode: string;
}) => {
  if (streetData.length > 0) {
    await insertStreetsFromDbf(streetData);
  }
  await setCityPolygonGeojson(polygonData, cityCode);
};

const attempts = 5;

export const downloadAndImportStreets = async (
  options: OpenDataSyncOptionsPartial = {}
): Promise<void> => {
  await runSyncPart(SyncPart.Streets, [SyncPart.AddressPoints], async () => {
    console.log(
      "Starting to download and import streets. This takes up to 1 hour."
    );

    const completeOptions = prepareOptions(options);
    prepareFolders(completeOptions);

    const allDatasetFeedLinks = await getAllUrlsFromAtomFeed(
      completeOptions.streetsAtomUrl
    );

    console.log(`Total of ${allDatasetFeedLinks.length} links to ZIP files.`);

    const syncedStreetLinks = await getAllSyncedStreets();

    const toDelete: string[] = [];
    // remove all deprecated links (not in the new list)
    syncedStreetLinks.forEach((link) => {
      if (!allDatasetFeedLinks.includes(link)) {
        toDelete.push(link);
        delete syncedStreetLinks[link];
      }
    });

    await deleteStreets(toDelete);

    let done = syncedStreetLinks.size;
    console.log(`Total of ${done} links to ZIP files already stored.`);

    // get all links not yet stored
    const newLinks = allDatasetFeedLinks.filter(
      (link) => !syncedStreetLinks.has(link)
    );

    let delay = 0;
    console.log(`Loading ${newLinks.length} new links to ZIP files.`);
    for (const link of newLinks) {
      for (let i = 0; i < attempts; i++) {
        try {
          const zipLink = await getLatestUrlFromAtomFeed(link);
          const data = await downloadZipAndParseFiles(
            zipLink,
            done,
            completeOptions
          );
          await importDataToDb(data);
          await setStreetAsSynced(link);

          done++;
          console.log(`Loaded links: ${done}/${allDatasetFeedLinks.length}`);
          await wait(delay);
          break;
        } catch (error) {
          if (i < attempts - 1) {
            delay += 100; // if error occured, it is likely to repeat so we wait a bit longer
            const waitTime = (i + 1) * 3;
            console.error(
              `Error connecting to CUZK servers, retrying in ${waitTime} seconds...`
            );
            await wait(waitTime * 1000);
          } else {
            throw error;
          }
        }
      }
    }
  });
};

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};
