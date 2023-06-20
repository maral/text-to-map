import { Founder } from "../db/types";
export interface OpenDataSyncOptions {
    tmpDir: string;
    dataDir: string;
    dbFilePath: string;
    dbInitFilePath: string;
    addressPointsAtomUrl: string;
    addressPointsZipFileName: string;
    addressPointsCsvFolderName: string;
    streetsAtomUrl: string;
    streetZipFolderName: string;
    streetDbfFileName: string;
    schoolsXmlUrl: string;
    schoolsXmlFileName: string;
    regionsCsvUrl: string;
    regionsSchemaUrl: string;
    regionsCsvFileName: string;
}
export type OpenDataSyncOptionsPartial = Partial<OpenDataSyncOptions>;
export declare const getAppDataDirPath: () => string;
export declare const prepareOptions: (options: OpenDataSyncOptionsPartial) => OpenDataSyncOptions;
export declare const initDb: (options: OpenDataSyncOptions) => void;
export declare const extractMunicipalityName: (founder: Founder) => string;
export declare const sanitizeMunicipalityName: (name: string) => string;
export declare const findClosestString: (str: string, arr: string[]) => string;
