import { OpenDataSyncOptionsPartial } from "../utils/helpers";
export declare const downloadAndImportSchools: (options?: OpenDataSyncOptionsPartial, saveFoundersToCsv?: boolean, saveSchoolsWithoutRuianToCsv?: boolean) => Promise<void>;
export declare const deleteSchoolsXmlFile: (options?: OpenDataSyncOptionsPartial) => void;
