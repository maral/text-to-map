import { downloadAndImportAddressPoints, deleteDb } from "./open-data-sync/address-points";
import { downloadAndImportRegions } from "./open-data-sync/regions";
import { downloadAndImportSchools } from "./open-data-sync/schools";
import { downloadAndImportStreets } from "./open-data-sync/streets";
import { parseOrdinanceToAddressPoints } from "./street-markdown/smd";
import { OpenDataSyncOptions } from "./utils/helpers";
export * from "./street-markdown/types";
/**
 * Download and import all open data to SQLite DB. The DB file will be located
 * in the `dataDir` folder.
 * @param options Options for the sync
 * @param syncStreets Streets sync takes around 1 hour, so it might be skipped.
 * ```typescript
 * import { downloadAndImportEverything } from "text-to-map";
 *
 * await downloadAndImportEverything({ tmpDir: "./tmp", dataDir: "./data" });
 * ```
 */
export declare function downloadAndImportEverything(options?: OpenDataSyncOptions, syncStreets?: boolean): Promise<void>;
export { downloadAndImportAddressPoints, deleteDb, downloadAndImportSchools, downloadAndImportStreets, downloadAndImportRegions, parseOrdinanceToAddressPoints, };
