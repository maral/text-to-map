import { DbfStreet } from "./types";
export declare const setStreetAsSynced: (streetFeedUrl: string) => void;
export declare const getAllSyncedStreets: () => Set<string>;
export declare const deleteStreets: (streetUrls: string[]) => void;
export declare const insertStreetsFromDbf: (data: DbfStreet[]) => number;
