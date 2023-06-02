/// <reference types="better-sqlite3" />
export declare const getMetaValue: (key: string) => string | undefined;
export declare const setMetaValue: (key: string, value: any) => import("better-sqlite3").RunResult;
export declare const setCurrentDatetimeMetaValue: (key: string) => void;
export declare const getDatetimeMetaValue: (key: string) => Date | undefined;
