var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getKnexDb, insertAutoincrementRow, isSqlite } from "./db";
import { SyncPart } from "./types";
const allParts = [
    SyncPart.AddressPoints,
    SyncPart.Schools,
    SyncPart.Regions,
    SyncPart.Streets,
];
const serializeDate = (date) => {
    return isSqlite(getKnexDb()) ? date.toISOString().slice(0, -1) : date;
};
const deserializeDate = (date) => {
    return isSqlite(getKnexDb()) ? new Date(date) : date;
};
export const startSyncPart = (part) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertAutoincrementRow([part.toString(), serializeDate(new Date())], "sync_log", ["part", "started_at"]);
});
export const setSyncPartAsCompleted = (id) => __awaiter(void 0, void 0, void 0, function* () {
    yield getKnexDb()
        .update({ finished_at: serializeDate(new Date()), completed: true })
        .from("sync_log")
        .where({ id });
});
export const isSyncPartCompleted = (part) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield getKnexDb()
        .select("id")
        .from("sync_log")
        .where({ part, completed: true })
        .limit(1);
    return result.length > 0;
});
export const isEverythingSynced = () => __awaiter(void 0, void 0, void 0, function* () {
    const results = yield Promise.all(allParts.map(isSyncPartCompleted));
    return results.every((r) => r);
});
export const millisecondsSinceLastSyncOfPart = (part) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield lastSyncOfPart(part);
    return result === null ? null : new Date().getTime() - result.getTime();
});
export const lastSyncOfPart = (part) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield getKnexDb()
        .select("finished_at")
        .from("sync_log")
        .where({ part, completed: true })
        .orderBy("finished_at", "desc")
        .limit(1);
    if (result.length === 0) {
        return null;
    }
    return deserializeDate(result[0].finished_at);
});
export const millisecondsSinceLastSync = () => __awaiter(void 0, void 0, void 0, function* () {
    const results = yield Promise.all(allParts.map(millisecondsSinceLastSyncOfPart));
    if (results.some((r) => r === null)) {
        return null;
    }
    return Math.max(...results);
});
export const lastSync = () => __awaiter(void 0, void 0, void 0, function* () {
    const results = yield Promise.all(allParts.map(lastSyncOfPart));
    if (results.some((r) => r === null)) {
        return null;
    }
    return new Date(Math.min(...results.map((r) => r.getTime())));
});
