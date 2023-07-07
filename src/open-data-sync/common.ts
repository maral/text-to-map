import { disconnectKnex } from "../db/db";
import { isSyncPartCompleted, setSyncPartAsCompleted, startSyncPart } from "../db/sync-log";
import { SyncPart } from "../db/types";

export const runSyncPart = async (
  part: SyncPart,
  dependencies: SyncPart[],
  partFunction: () => Promise<void>
): Promise<void> => {
  try {
    const logId = await startSyncPart(part);

    for (const dependency of dependencies) {
      const isCompleted = await isSyncPartCompleted(dependency);
      if (!isCompleted) {
        throw new Error(
          `Sync part ${part} cannot be started because dependency ${dependency} is not completed. Run 'npm run ${dependency}' first.`
        );
      }
    }
    await partFunction();

    await setSyncPartAsCompleted(logId);
  } catch (error) {
    console.log(error);
  } finally {
    await disconnectKnex();
  }
};
