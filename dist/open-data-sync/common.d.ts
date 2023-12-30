import { SyncPart } from "../db/types";
export declare const runSyncPart: (part: SyncPart, dependencies: SyncPart[], partFunction: () => Promise<void>) => Promise<void>;
