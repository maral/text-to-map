import { SyncPart } from "./types";
export declare const startSyncPart: (part: SyncPart) => Promise<number>;
export declare const setSyncPartAsCompleted: (id: number) => Promise<void>;
export declare const isSyncPartCompleted: (part: SyncPart) => Promise<boolean>;
export declare const isEverythingSynced: () => Promise<boolean>;
export declare const millisecondsSinceLastSyncOfPart: (part: SyncPart) => Promise<number | null>;
export declare const lastSyncOfPart: (part: SyncPart) => Promise<Date | null>;
export declare const millisecondsSinceLastSync: () => Promise<number | null>;
export declare const lastSync: () => Promise<Date | null>;
