import Database from "better-sqlite3";
import { existsSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
let _db;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaults = {
    filePath: "address_points.db",
    initFilePath: join(__dirname, "..", "address_points_init.db"),
    verbose: false,
};
export const setDbConfig = (config) => {
    _db = undefined;
    getDb(config);
};
export const getDb = (config = {}) => {
    const options = Object.assign(Object.assign({}, defaults), config);
    if (typeof _db === "undefined") {
        if (!existsSync(options.filePath)) {
            copyFileSync(options.initFilePath, options.filePath);
        }
        const dbSettings = options.verbose ? { verbose: console.log } : {};
        _db = new Database(options.filePath, dbSettings);
        _db.pragma("journal_mode = WAL");
        // @ts-ignore
        _db.filePath = options.filePath;
    }
    return _db;
};
export const nonEmptyOrNull = (value) => {
    return value ? value : null;
};
/**
 * Efficiently insert multiple rows. If preventDuplicatesByFirstColumn is true, the first
 * column should be unique (PK or UNIQUE).
 */
export const insertMultipleRows = (rows, table, columnNames, preventDuplicatesByFirstColumn = true) => {
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
    const insertPlaceholders = generateRepetitiveString(`(${generatePlaceholders(columnNames.length)})`, ",", rows.length);
    const insertStatement = db.prepare(`INSERT INTO ${table} (${columnNames.join(",")}) VALUES ${insertPlaceholders}`);
    return insertStatement.run(rows.flat()).changes;
};
/**
 * Insert a single row and return the autoincremented ID.
 */
export const insertAutoincrementRow = (row, table, columnNames) => {
    const db = getDb();
    const insertStatement = db.prepare(`INSERT INTO ${table} (${columnNames.join(",")}) VALUES (${generatePlaceholders(columnNames.length)})`);
    const result = insertStatement.run(row);
    return result.changes === 1 ? Number(result.lastInsertRowid) : null;
};
export const deleteMultipleRows = (keys, table, keyColumnName) => {
    const db = getDb();
    if (keys.length === 0) {
        return;
    }
    db.prepare(`DELETE FROM ${table} WHERE ${keyColumnName} IN (${generatePlaceholders(keys.length)})`).run(keys);
};
export const clearDuplicates = (rows, table, columnNames) => {
    const db = getDb();
    const selectPlaceholders = generatePlaceholders(rows.length);
    const selectStatement = db.prepare(`SELECT ${columnNames[0]} FROM ${table} WHERE ${columnNames[0]} IN (${selectPlaceholders})`);
    const existing = selectStatement
        .pluck()
        .all(rows.map((row) => row[0]))
        .map((key) => key.toString());
    return rows.filter((row) => !existing.includes(row[0]));
};
export const disconnect = () => {
    getDb().close();
};
const generateRepetitiveString = (value, glue, n) => {
    return new Array(n).fill(value).join(glue);
};
export const generatePlaceholders = (n) => {
    return generateRepetitiveString("?", ",", n);
};
export const generate2DPlaceholders = (inner, outer) => {
    return generateRepetitiveString(`(${generatePlaceholders(inner)})`, ",", outer);
};
export const extractKeyValuesPairs = (array, keyIndex, valuesIndices) => {
    const object = array.reduce((acc, data) => {
        if (data[keyIndex]) {
            acc[data[keyIndex]] = valuesIndices.map((index) => nonEmptyOrNull(data[index]));
        }
        return acc;
    }, {});
    return Object.keys(object).map((key) => [key, ...object[key]]);
};
