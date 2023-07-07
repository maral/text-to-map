var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { disconnectKnex } from "../db/db";
import { isSyncPartCompleted, setSyncPartAsCompleted, startSyncPart } from "../db/sync-log";
export const runSyncPart = (part, dependencies, partFunction) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const logId = yield startSyncPart(part);
        for (const dependency of dependencies) {
            const isCompleted = yield isSyncPartCompleted(dependency);
            if (!isCompleted) {
                throw new Error(`Sync part ${part} cannot be started because dependency ${dependency} is not completed. Run 'npm run ${dependency}' first.`);
            }
        }
        yield partFunction();
        yield setSyncPartAsCompleted(logId);
    }
    catch (error) {
        console.log(error);
    }
    finally {
        yield disconnectKnex();
    }
});
