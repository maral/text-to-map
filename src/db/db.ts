import { configDotenv } from "dotenv";
import knex, { Knex } from "knex";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

interface DbConfig {
  dbType: SupportedDbType;
  pgConnectionString?: string;
  mysqlConnectionString?: string;
  initFilePath: string;
  filePath?: string;
  verbose: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export enum SupportedDbType {
  sqlite = "sqlite",
  postgres = "postgres",
  mysql = "mysql",
}

const mysqlConnectionStringPattern = /^([^:]+):(\d+):([^:]+):([^:]+):([^:]+)$/;

const DbClient = {
  [SupportedDbType.sqlite]: "better-sqlite3",
  [SupportedDbType.postgres]: "pg",
  [SupportedDbType.mysql]: "mysql",
};

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
        client: DbClient[SupportedDbType.sqlite],
        connection: {
          filename: _knexDbConfig.filePath,
        },
        pool: {
          afterCreate: (db: any, done: Function) => {
            db.pragma("journal_mode = WAL;");
            done(false, done);
          },
        },
        useNullAsDefault: true,
        debug: _knexDbConfig.verbose,
      });
    } else if (_knexDbConfig.dbType === SupportedDbType.postgres) {
      _knexDb = knex({
        client: DbClient[SupportedDbType.postgres],
        connection: _knexDbConfig.pgConnectionString,
        useNullAsDefault: true,
        debug: _knexDbConfig.verbose,
      });
    } else if (_knexDbConfig.dbType === SupportedDbType.mysql) {
      const [host, port, user, password, database] =
        _knexDbConfig.mysqlConnectionString.split(":");
      _knexDb = knex({
        client: DbClient[SupportedDbType.mysql],
        connection: {
          host,
          port: Number(port),
          user,
          password,
          database,
        },
        useNullAsDefault: true,
        debug: _knexDbConfig.verbose,
      });
    } else {
      throw new Error(`Unsupported DB type: ${_knexDbConfig.dbType}`);
    }
  }

  return _knexDb;
};

export const isPostgres = (knex: Knex): boolean => {
  return knex.client.config.client === DbClient[SupportedDbType.postgres];
};

export const isSqlite = (knex: Knex): boolean => {
  return knex.client.config.client === DbClient[SupportedDbType.sqlite];
};

export const isMysql = (knex: Knex): boolean => {
  return knex.client.config.client === DbClient[SupportedDbType.mysql];
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
    } else if (envConfig.dbType === SupportedDbType.mysql) {
      if (!process.env.TEXTTOMAP_MYSQL_CONNECTION_DATA) {
        throw new Error(
          "Environmental variable 'TEXTTOMAP_MYSQL_CONNECTION_DATA' must be set for MySQL or MariaDB."
        );
      }

      if (
        !mysqlConnectionStringPattern.test(
          process.env.TEXTTOMAP_MYSQL_CONNECTION_DATA
        )
      ) {
        throw new Error(
          "Environmental variable 'TEXTTOMAP_MYSQL_CONNECTION_DATA' must be in format 'host:port:user:password:database'."
        );
      }
      envConfig.mysqlConnectionString =
        process.env.TEXTTOMAP_MYSQL_CONNECTION_DATA;
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

export const rawQuery = async (
  query: string,
  ...bindings: readonly Knex.RawBinding[]
): Promise<any[]> => {
  const knex = getKnexDb();
  const result = await knex.raw(query, ...bindings);
  return isMysql(knex) ? result[0] : result;
};

/**
 * Efficiently insert multiple rows. If preventDuplicatesByFirstColumn is true, the first
 * column should be unique (PK or UNIQUE).
 */
export const insertMultipleRows = async (
  rows: string[][],
  table: string,
  columnNames: string[],
  preventDuplicates: boolean = true
): Promise<number> => {
  if (rows.length === 0) {
    return 0;
  }

  const insertPlaceholders = generate2DPlaceholders(
    columnNames.length,
    rows.length
  );

  const knex = getKnexDb();

  const onConfict =
    preventDuplicates && !isMysql(knex) ? `ON CONFLICT DO NOTHING` : "";

  await rawQuery(
    `INSERT ${isMysql(knex) ? "IGNORE" : ""} INTO ${table} (${columnNames.join(
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
  row: any[],
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
