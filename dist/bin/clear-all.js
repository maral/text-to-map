var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { clearDb, disconnectKnex } from "../db/db";
import { deleteSchoolsXmlFile } from "../open-data-sync/schools";
import { defaultBinOptions } from "./constants";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Clearing all data...");
        yield clearDb();
        console.log("DB cleared. Now deleting schools XML file...");
        deleteSchoolsXmlFile(defaultBinOptions);
        yield disconnectKnex();
        console.log("Everything cleared, ready for a new sync.");
    });
}
main();
