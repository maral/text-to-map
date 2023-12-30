import { getKnexDb, insertAutoincrementRow, isSqlite } from "./db";
import { SyncPart } from "./types";

const allParts = [
  SyncPart.AddressPoints,
  SyncPart.Schools,
  SyncPart.Regions,
  SyncPart.Streets,
];

const serializeDate = (date: Date): string | Date => {
  return isSqlite(getKnexDb()) ? date.toISOString().slice(0, -1) : date;
};

const deserializeDate = (date: string | Date): Date => {
  return isSqlite(getKnexDb()) ? new Date(date) : (date as Date);
};

export const startSyncPart = async (part: SyncPart): Promise<number> => {
  return await insertAutoincrementRow(
    [part.toString(), serializeDate(new Date())],
    "sync_log",
    ["part", "started_at"]
  );
};

export const setSyncPartAsCompleted = async (id: number): Promise<void> => {
  await getKnexDb()
    .update({ finished_at: serializeDate(new Date()), completed: true })
    .from("sync_log")
    .where({ id });
};

export const isSyncPartCompleted = async (part: SyncPart): Promise<boolean> => {
  const result = await getKnexDb()
    .select("id")
    .from("sync_log")
    .where({ part, completed: true })
    .limit(1);

  return result.length > 0;
};

export const isEverythingSynced = async (): Promise<boolean> => {
  const results = await Promise.all(allParts.map(isSyncPartCompleted));
  return results.every((r) => r);
};

export const millisecondsSinceLastSyncOfPart = async (
  part: SyncPart
): Promise<number | null> => {
  const result = await lastSyncOfPart(part);
  return result === null ? null : new Date().getTime() - result.getTime();
};

export const lastSyncOfPart = async (part: SyncPart): Promise<Date | null> => {
  const result = await getKnexDb()
    .select("finished_at")
    .from("sync_log")
    .where({ part, completed: true })
    .orderBy("finished_at", "desc")
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return deserializeDate(result[0].finished_at);
};

export const millisecondsSinceLastSync = async (): Promise<number | null> => {
  const results = await Promise.all(
    allParts.map(millisecondsSinceLastSyncOfPart)
  );
  if (results.some((r) => r === null)) {
    return null;
  }
  return Math.max(...results);
};

export const lastSync = async (): Promise<Date | null> => {
  const results = await Promise.all(allParts.map(lastSyncOfPart));
  if (results.some((r) => r === null)) {
    return null;
  }
  return new Date(Math.min(...results.map((r) => r.getTime())));
};
