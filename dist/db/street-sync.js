var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { deleteMultipleRowsKnex, getKnexDb, insertMultipleRows } from "./db";
export const setStreetAsSynced = (streetFeedUrl) => __awaiter(void 0, void 0, void 0, function* () {
    yield getKnexDb()("street_sync")
        .insert({ feed_url: streetFeedUrl })
        .onConflict("feed_url")
        .ignore();
});
export const getAllSyncedStreets = () => __awaiter(void 0, void 0, void 0, function* () {
    return new Set(yield getKnexDb()("street_sync")
        .select("feed_url")
        .then((rows) => rows.map((row) => row.feed_url)));
});
export const deleteStreets = (streetUrls) => __awaiter(void 0, void 0, void 0, function* () {
    yield deleteMultipleRowsKnex(streetUrls, "street_sync", "feed_url");
});
export const insertStreetsFromDbf = (data) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(data.map((street) => [street.KOD, street.OBEC_KOD, street.NAZEV]), "street", ["code", "city_code", "name"]);
});
