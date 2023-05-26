import { Founder } from "../db/types";
export interface OpenDataSyncOptions {
    tmpDir?: string;
    dataDir?: string;
    dbFilePath?: string;
    dbInitFilePath?: string;
    addressPointsAtomUrl?: string;
    addressPointsZipFileName?: string;
    addressPointsCsvFolderName?: string;
    streetsAtomUrl?: string;
    streetZipFolderName?: string;
    streetDbfFileName?: string;
    schoolsXmlUrl?: string;
    schoolsXmlFileName?: string;
}
export interface OpenDataSyncOptionsNotEmpty {
    tmpDir: string;
    dataDir: string;
    dbFilePath: string;
    dbInitFilePath: string;
    addressPointsAtomUrl: string;
    addressPointsZipFileName: string;
    addressPointsCsvFolderName: string;
    streetsAtomUrl: string;
    streetFolderName: string;
    streetDbfFileName: string;
    schoolsXmlUrl: string;
    schoolsXmlFileName: string;
}
export declare const getAppDataDirPath: () => string;
export declare const prepareOptions: (options: OpenDataSyncOptions) => OpenDataSyncOptionsNotEmpty;
export declare const initDb: (options: OpenDataSyncOptionsNotEmpty) => void;
export declare const extractMunicipalityName: (founder: Founder) => string;
export declare const findClosestString: (str: string, arr: string[]) => string;
