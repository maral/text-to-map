import {
  deleteMultipleRowsKnex,
  getKnexDb,
  insertMultipleRows
} from "./db";
import { DbfStreet } from "./types";

export const setStreetAsSynced = async (
  streetFeedUrl: string
): Promise<void> => {
  await getKnexDb()("street_sync")
    .insert({ feed_url: streetFeedUrl })
    .onConflict("feed_url")
    .ignore();
};

export const getAllSyncedStreets = async (): Promise<Set<string>> => {
  return new Set<string>(
    await getKnexDb()("street_sync")
      .select("feed_url")
      .then((rows) => rows.map((row) => row.feed_url))
  );
};

export const deleteStreets = async (streetUrls: string[]): Promise<void> => {
  await deleteMultipleRowsKnex(streetUrls, "street_sync", "feed_url");
};

export const insertStreetsFromDbf = async (
  data: DbfStreet[]
): Promise<number> => {
  return await insertMultipleRows(
    data.map((street) => [street.KOD, street.OBEC_KOD, street.NAZEV]),
    "street",
    ["code", "city_code", "name"]
  );
};
