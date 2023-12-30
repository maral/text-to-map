import { Knex } from "knex";
interface DbConfig {
    dbType: SupportedDbType;
    pgConnectionString?: string;
    mysqlConnectionString?: string;
    initFilePath: string;
    filePath?: string;
    verbose: boolean;
}
export declare enum SupportedDbType {
    sqlite = "sqlite",
    postgres = "postgres",
    mysql = "mysql"
}
export declare const getKnexDb: (config?: Partial<DbConfig>) => Knex;
export declare const isPostgres: (knex: Knex) => boolean;
export declare const isSqlite: (knex: Knex) => boolean;
export declare const isMysql: (knex: Knex) => boolean;
export declare const initDb: (config?: Partial<DbConfig>) => Promise<Knex>;
export declare const clearDb: (config?: Partial<DbConfig>) => Promise<Knex>;
export declare const disconnectKnex: () => Promise<void>;
export declare const nonEmptyOrNull: (value: string) => string | null;
export declare const rawQuery: (query: string, ...bindings: readonly Knex.RawBinding[]) => Promise<any[]>;
/**
 * Efficiently insert multiple rows. If preventDuplicatesByFirstColumn is true, the first
 * column should be unique (PK or UNIQUE).
 */
export declare const insertMultipleRows: (rows: string[][], table: string, columnNames: string[], preventDuplicates?: boolean) => Promise<number>;
/**
 * Insert a single row and return the autoincremented ID.
 */
export declare const insertAutoincrementRow: (row: any[], table: string, columnNames: string[]) => Promise<number | null>;
export declare const deleteMultipleRowsKnex: (keys: string[], table: string, keyColumnName: string) => Promise<void>;
export declare const generatePlaceholders: (n: number) => string;
export declare const generate2DPlaceholders: (inner: number, outer: number) => string;
export declare const extractKeyValuesPairs: (array: string[][], keyIndex: number, valuesIndices: number[]) => string[][];
export {};
