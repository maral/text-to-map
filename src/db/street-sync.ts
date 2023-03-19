import { deleteMultipleRows, getDb, insertMultipleRows } from "./db";
import { DbfStreet } from "./types";

export const setStreetAsSynced = (streetFeedUrl: string): void => {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO street_sync (feed_url) VALUES (?)").run(
    streetFeedUrl
  );
};

export const getAllSyncedStreets = (): Set<string> => {
  const db = getDb();
  return new Set<string>(
    db
      .prepare("SELECT * FROM street_sync")
      .all()
      .map((row) => row.feed_url)
  );
};

export const deleteStreets = (streetUrls: string[]): void => {
  deleteMultipleRows(streetUrls, "street_sync", "feed_url");
};

export const insertStreetsFromDbf = (data: DbfStreet[]): number => {
  return insertMultipleRows(
    data.map((street) => [street.KOD, street.OBEC_KOD, street.NAZEV]),
    "street",
    ["code", "city_code", "name"]
  );
};
