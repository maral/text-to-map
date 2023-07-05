import { DbfStreet } from "./types";
export declare const setStreetAsSynced: (streetFeedUrl: string) => Promise<void>;
export declare const getAllSyncedStreets: () => Promise<Set<string>>;
export declare const deleteStreets: (streetUrls: string[]) => Promise<void>;
export declare const insertStreetsFromDbf: (data: DbfStreet[]) => Promise<number>;
