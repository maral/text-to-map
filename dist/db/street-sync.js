import { deleteMultipleRows, getDb, insertMultipleRows } from "./db";
export const setStreetAsSynced = (streetFeedUrl) => {
    const db = getDb();
    db.prepare("INSERT OR IGNORE INTO street_sync (feed_url) VALUES (?)").run(streetFeedUrl);
};
export const getAllSyncedStreets = () => {
    const db = getDb();
    return new Set(db
        .prepare("SELECT * FROM street_sync")
        .all()
        .map((row) => row.feed_url));
};
export const deleteStreets = (streetUrls) => {
    deleteMultipleRows(streetUrls, "street_sync", "feed_url");
};
export const insertStreetsFromDbf = (data) => {
    return insertMultipleRows(data.map((street) => [street.KOD, street.OBEC_KOD, street.NAZEV]), "street", ["code", "city_code", "name"]);
};
