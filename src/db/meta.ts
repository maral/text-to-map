import { getDb } from "./db";

export const getMetaValue = (key: string): string | undefined => {
  const db = getDb();
  const statement = db.prepare("SELECT value FROM meta WHERE key = ?");
  return statement.pluck().get(key);
};

export const setMetaValue = (key: string, value: any) => {
  const db = getDb();
  if (getMetaValue(key) === undefined) {
    const statement = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
    return statement.run(key, value.toString());
  } else {
    const statement = db.prepare("UPDATE meta SET value = ? WHERE key = ?");
    return statement.run(value.toString(), key);
  }
};
