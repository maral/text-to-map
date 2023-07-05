import { configDotenv } from "dotenv";
import knex, { Knex } from "knex";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

interface DbConfig {
  dbType: SupportedDbType;
  pgConnectionString?: string;
  initFilePath: string;
  filePath?: string;
  verbose: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export enum SupportedDbType {
  sqlite = "sqlite",
  postgres = "postgres",
}

const defaults: DbConfig = {
  dbType: SupportedDbType.sqlite,
  filePath: "address_points.db",
  initFilePath: join(__dirname, "..", "address_points_init.db"),
  verbose: false,
};

let _knexDb: Knex = undefined;
let _knexDbConfig: DbConfig = undefined;

export const getKnexDb = (config: Partial<DbConfig> = {}): Knex => {
  if (_knexDb === undefined) {
    _knexDbConfig = { ...defaults, ...getEnvConfig(), ...config };

    if (_knexDbConfig.dbType === SupportedDbType.sqlite) {
      _knexDb = knex({
        client: "better-sqlite3",
        connection: {
          filename: _knexDbConfig.filePath,
        },
        useNullAsDefault: true,
        debug: _knexDbConfig.verbose,
      });
    } else if (_knexDbConfig.dbType === SupportedDbType.postgres) {
      _knexDb = knex({
        client: "pg",
        connection: _knexDbConfig.pgConnectionString,
        useNullAsDefault: true,
      });
    } else {
      throw new Error(`Unsupported DB type: ${_knexDbConfig.dbType}`);
    }
  }

  return _knexDb;
};

export const isPostgres = (): boolean => {
  return isDbType(SupportedDbType.postgres);
}

export const isSqlite = (): boolean => {
  return isDbType(SupportedDbType.sqlite);
}

const isDbType = (type: SupportedDbType): boolean => {
  if (_knexDbConfig === undefined) {
    throw new Error("DB not initialized");
  }
  return _knexDbConfig.dbType === type;
};

const getMigrationConfig = (): Knex.MigratorConfig => {
  return { directory: join(__dirname, "migrations") };
};

export const initDb = async (config: Partial<DbConfig> = {}): Promise<Knex> => {
  const knex = getKnexDb(config);
  await knex.migrate.latest(getMigrationConfig());
  return knex;
};

export const clearDb = async (
  config: Partial<DbConfig> = {}
): Promise<Knex> => {
  const knex = getKnexDb(config);
  await knex.migrate.rollback(getMigrationConfig(), true);
  await knex.migrate.latest(getMigrationConfig());
  return knex;
};

export const disconnectKnex = async (): Promise<void> => {
  if (_knexDb) {
    await _knexDb.destroy();
    _knexDb = undefined;
  }
};

const getEnvConfig = (): Partial<DbConfig> => {
  configDotenv({ path: ".env.local" });
  const envConfig: Partial<DbConfig> = {};
  if (
    process.env.TEXTTOMAP_DB_TYPE &&
    Object.values(SupportedDbType).includes(
      process.env.TEXTTOMAP_DB_TYPE as SupportedDbType
    )
  ) {
    envConfig.dbType = process.env.TEXTTOMAP_DB_TYPE as SupportedDbType;
    if (envConfig.dbType === SupportedDbType.postgres) {
      if (!process.env.TEXTTOMAP_PG_CONNECTION_STRING) {
        throw new Error(
          "Environmental variable 'TEXTTOMAP_PG_CONNECTION_STRING' must be set for PostgreSQL."
        );
      }
      envConfig.pgConnectionString = process.env.TEXTTOMAP_PG_CONNECTION_STRING;
    } else if (envConfig.dbType === SupportedDbType.sqlite) {
      if (process.env.TEXTTOMAP_SQLITE_PATH) {
        envConfig.filePath = process.env.TEXTTOMAP_SQLITE_PATH;
      }
    }
  }
  return envConfig;
};

export const nonEmptyOrNull = (value: string): string | null => {
  return value ? value : null;
};

/**
 * Efficiently insert multiple rows. If preventDuplicatesByFirstColumn is true, the first
 * column should be unique (PK or UNIQUE).
 */
export const insertMultipleRows = async (
  rows: string[][],
  table: string,
  columnNames: string[],
  preventDuplicatesByFirstColumn: boolean = true
): Promise<number> => {
  if (rows.length === 0) {
    return 0;
  }

  // if (preventDuplicatesByFirstColumn) {
  //   rows = await clearDuplicates(rows, table, columnNames);
  //   if (rows.length === 0) {
  //     return 0;
  //   }
  // }

  const insertPlaceholders = generate2DPlaceholders(
    columnNames.length,
    rows.length
  );

  const onConfict = preventDuplicatesByFirstColumn ? `ON CONFLICT (${columnNames[0]}) DO NOTHING` : '';

  await getKnexDb().raw(
    `INSERT INTO ${table} (${columnNames.join(
      ","
    )}) VALUES ${insertPlaceholders} ${onConfict}`,
    rows.flat()
  );

  return rows.length;
};

/**
 * Insert a single row and return the autoincremented ID.
 */
export const insertAutoincrementRow = async (
  row: string[],
  table: string,
  columnNames: string[]
): Promise<number | null> => {
  const data = columnNames.reduce((obj, columnName, index) => {
    obj[columnName] = row[index];
    return obj;
  }, {});

  const result = await getKnexDb().insert(data).into(table);

  return result ? Number(result) : null;
};

export const deleteMultipleRowsKnex = async (
  keys: string[],
  table: string,
  keyColumnName: string
): Promise<void> => {
  if (keys.length === 0) {
    return;
  }
  await getKnexDb().from(table).whereIn(keyColumnName, keys).del();
};

export const clearDuplicates = async (
  rows: string[][],
  table: string,
  columnNames: string[]
): Promise<string[][]> => {
  const existing = await getKnexDb()
    .select(columnNames[0])
    .from(table)
    .whereIn(
      columnNames[0],
      rows.map((row) => row[0])
    );
  const keys = existing.map((row) => row[columnNames[0]].toString());

  return rows.filter((row) => !keys.includes(row[0]));
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

export const generate2DPlaceholders = (
  inner: number,
  outer: number
): string => {
  return generateRepetitiveString(
    `(${generatePlaceholders(inner)})`,
    ",",
    outer
  );
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
