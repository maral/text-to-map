var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { downloadAndImportAddressPoints, deleteDb, } from "./open-data-sync/address-points";
import { downloadAndImportRegions } from "./open-data-sync/regions";
import { downloadAndImportSchools } from "./open-data-sync/schools";
import { downloadAndImportStreets } from "./open-data-sync/streets";
import { parseOrdinanceToAddressPoints } from "./street-markdown/smd";
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
export function downloadAndImportEverything(options = {}, syncStreets = true) {
    return __awaiter(this, void 0, void 0, function* () {
        yield downloadAndImportAddressPoints(options);
        yield downloadAndImportSchools(options);
        yield downloadAndImportRegions(options);
        if (syncStreets) {
            yield downloadAndImportStreets(options);
        }
    });
}
export { downloadAndImportAddressPoints, deleteDb, downloadAndImportSchools, downloadAndImportStreets, downloadAndImportRegions, parseOrdinanceToAddressPoints, };
