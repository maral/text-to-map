import Database from "better-sqlite3";
interface DbConfig {
    initFilePath?: string;
    filePath?: string;
    verbose?: boolean;
}
export declare const setDbConfig: (config: DbConfig) => void;
export declare const getDb: (config?: DbConfig) => Database.Database;
export declare const nonEmptyOrNull: (value: string) => string | null;
/**
 * Efficiently insert multiple rows. If preventDuplicatesByFirstColumn is true, the first
 * column should be unique (PK or UNIQUE).
 */
export declare const insertMultipleRows: (rows: string[][], table: string, columnNames: string[], preventDuplicatesByFirstColumn?: boolean) => number;
/**
 * Insert a single row and return the autoincremented ID.
 */
export declare const insertAutoincrementRow: (row: string[], table: string, columnNames: string[]) => number;
export declare const deleteMultipleRows: (keys: string[], table: string, keyColumnName: string) => void;
export declare const clearDuplicates: (rows: string[][], table: string, columnNames: string[]) => string[][];
export declare const disconnect: () => void;
export declare const extractKeyValuesPairs: (array: string[][], keyIndex: number, valuesIndices: number[]) => string[][];
export {};
