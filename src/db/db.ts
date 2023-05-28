import Database from "better-sqlite3";
import { existsSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

let _db: Database.Database;

interface DbConfig {
  initFilePath?: string;
  filePath?: string;
  verbose?: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaults = {
  filePath: "address_points.db",
  initFilePath: join(__dirname, "..", "address_points_init.db"),
  verbose: false,
};

export const setDbConfig = (config: DbConfig): void => {
  _db = undefined;
  getDb(config);
};

export const getDb = (config: DbConfig = {}): Database.Database => {
  const options = { ...defaults, ...config };
  if (typeof _db === "undefined") {
    if (!existsSync(options.filePath)) {
      copyFileSync(options.initFilePath, options.filePath);
    }

    const dbSettings = options.verbose ? { verbose: console.log } : {};
    _db = new Database(options.filePath, dbSettings);
    _db.pragma("journal_mode = WAL");
  }

  return _db;
};

export const nonEmptyOrNull = (value: string): string | null => {
  return value ? value : null;
};

/**
 * Efficiently insert multiple rows. If preventDuplicatesByFirstColumn is true, the first
 * column should be unique (PK or UNIQUE).
 */
export const insertMultipleRows = (
  rows: string[][],
  table: string,
  columnNames: string[],
  preventDuplicatesByFirstColumn: boolean = true
): number => {
  const db = getDb();

  if (rows.length === 0) {
    return 0;
  }

  if (preventDuplicatesByFirstColumn) {
    rows = clearDuplicates(rows, table, columnNames);
    if (rows.length === 0) {
      return 0;
    }
  }

  const insertPlaceholders = generateRepetitiveString(
    `(${generatePlaceholders(columnNames.length)})`,
    ",",
    rows.length
  );

  const insertStatement = db.prepare(
    `INSERT INTO ${table} (${columnNames.join(
      ","
    )}) VALUES ${insertPlaceholders}`
  );

  return insertStatement.run(rows.flat()).changes;
};

/**
 * Insert a single row and return the autoincremented ID.
 */
export const insertAutoincrementRow = (
  row: string[],
  table: string,
  columnNames: string[]
): number => {
  const db = getDb();

  const insertStatement = db.prepare(
    `INSERT INTO ${table} (${columnNames.join(
      ","
    )}) VALUES (${generatePlaceholders(columnNames.length)})`
  );

  return Number(insertStatement.run(row).lastInsertRowid);
};

export const deleteMultipleRows = (
  keys: string[],
  table: string,
  keyColumnName: string
): void => {
  const db = getDb();

  if (keys.length === 0) {
    return;
  }
  db.prepare(
    `DELETE FROM ${table} WHERE ${keyColumnName} IN (${generatePlaceholders(
      keys.length
    )})`
  ).run(keys);
};

export const clearDuplicates = (
  rows: string[][],
  table: string,
  columnNames: string[]
): string[][] => {
  const db = getDb();

  const selectPlaceholders = generatePlaceholders(rows.length);

  const selectStatement = db.prepare(
    `SELECT ${columnNames[0]} FROM ${table} WHERE ${columnNames[0]} IN (${selectPlaceholders})`
  );

  const existing = selectStatement
    .pluck()
    .all(rows.map((row) => row[0]))
    .map((key) => key.toString());
  return rows.filter((row) => !existing.includes(row[0]));
};

export const disconnect = (): void => {
  getDb().close();
};

const generateRepetitiveString = (
  value: string,
  glue: string,
  n: number
): string => {
  return new Array(n).fill(value).join(glue);
};

export const generatePlaceholders = (n: number): string => {
  return generateRepetitiveString("?", ",", n);
};

export const extractKeyValuesPairs = (
  array: string[][],
  keyIndex: number,
  valuesIndices: number[]
): string[][] => {
  const object = array.reduce((acc: object, data: string[]) => {
    if (data[keyIndex]) {
      acc[data[keyIndex]] = valuesIndices.map((index: number) =>
        nonEmptyOrNull(data[index])
      );
    }
    return acc;
  }, {});

  return Object.keys(object).map((key) => [key, ...object[key]]);
};
