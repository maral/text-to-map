var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { configDotenv } from "dotenv";
import knex from "knex";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export var SupportedDbType;
(function (SupportedDbType) {
    SupportedDbType["sqlite"] = "sqlite";
    SupportedDbType["postgres"] = "postgres";
    SupportedDbType["mysql"] = "mysql";
})(SupportedDbType || (SupportedDbType = {}));
const mysqlConnectionStringPattern = /^([^:]+):(\d+):([^:]+):([^:]+):([^:]+)$/;
const DbClient = {
    [SupportedDbType.sqlite]: "better-sqlite3",
    [SupportedDbType.postgres]: "pg",
    [SupportedDbType.mysql]: "mysql",
};
const defaults = {
    dbType: SupportedDbType.sqlite,
    filePath: "address_points.db",
    initFilePath: join(__dirname, "..", "address_points_init.db"),
    verbose: false,
};
let _knexDb = undefined;
let _knexDbConfig = undefined;
export const getKnexDb = (config = {}) => {
    if (_knexDb === undefined) {
        _knexDbConfig = Object.assign(Object.assign(Object.assign({}, defaults), getEnvConfig()), config);
        if (_knexDbConfig.dbType === SupportedDbType.sqlite) {
            _knexDb = knex({
                client: DbClient[SupportedDbType.sqlite],
                connection: {
                    filename: _knexDbConfig.filePath,
                },
                pool: {
                    afterCreate: (db, done) => {
                        db.pragma("journal_mode = WAL;");
                        done(false, done);
                    },
                },
                useNullAsDefault: true,
                debug: _knexDbConfig.verbose,
            });
        }
        else if (_knexDbConfig.dbType === SupportedDbType.postgres) {
            _knexDb = knex({
                client: DbClient[SupportedDbType.postgres],
                connection: _knexDbConfig.pgConnectionString,
                useNullAsDefault: true,
            });
        }
        else if (_knexDbConfig.dbType === SupportedDbType.mysql) {
            const [host, port, user, password, database] = _knexDbConfig.mysqlConnectionString.split(":");
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
            });
        }
        else {
            throw new Error(`Unsupported DB type: ${_knexDbConfig.dbType}`);
        }
    }
    return _knexDb;
};
export const isPostgres = (knex) => {
    return knex.client.config.client === DbClient[SupportedDbType.postgres];
};
export const isSqlite = (knex) => {
    return knex.client.config.client === DbClient[SupportedDbType.sqlite];
};
export const isMysql = (knex) => {
    return knex.client.config.client === DbClient[SupportedDbType.mysql];
};
const getMigrationConfig = () => {
    return { directory: join(__dirname, "migrations") };
};
export const initDb = (config = {}) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb(config);
    yield knex.migrate.latest(getMigrationConfig());
    return knex;
});
export const clearDb = (config = {}) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb(config);
    yield knex.migrate.rollback(getMigrationConfig(), true);
    yield knex.migrate.latest(getMigrationConfig());
    return knex;
});
export const disconnectKnex = () => __awaiter(void 0, void 0, void 0, function* () {
    if (_knexDb) {
        yield _knexDb.destroy();
        _knexDb = undefined;
    }
});
const getEnvConfig = () => {
    configDotenv({ path: ".env.local" });
    const envConfig = {};
    if (process.env.TEXTTOMAP_DB_TYPE &&
        Object.values(SupportedDbType).includes(process.env.TEXTTOMAP_DB_TYPE)) {
        envConfig.dbType = process.env.TEXTTOMAP_DB_TYPE;
        if (envConfig.dbType === SupportedDbType.postgres) {
            if (!process.env.TEXTTOMAP_PG_CONNECTION_STRING) {
                throw new Error("Environmental variable 'TEXTTOMAP_PG_CONNECTION_STRING' must be set for PostgreSQL.");
            }
            envConfig.pgConnectionString = process.env.TEXTTOMAP_PG_CONNECTION_STRING;
        }
        else if (envConfig.dbType === SupportedDbType.mysql) {
            if (!process.env.TEXTTOMAP_MYSQL_CONNECTION_DATA) {
                throw new Error("Environmental variable 'TEXTTOMAP_MYSQL_CONNECTION_DATA' must be set for MySQL or MariaDB.");
            }
            if (!mysqlConnectionStringPattern.test(process.env.TEXTTOMAP_MYSQL_CONNECTION_DATA)) {
                throw new Error("Environmental variable 'TEXTTOMAP_MYSQL_CONNECTION_DATA' must be in format 'host:port:user:password:database'.");
            }
            envConfig.mysqlConnectionString =
                process.env.TEXTTOMAP_MYSQL_CONNECTION_DATA;
        }
        else if (envConfig.dbType === SupportedDbType.sqlite) {
            if (process.env.TEXTTOMAP_SQLITE_PATH) {
                envConfig.filePath = process.env.TEXTTOMAP_SQLITE_PATH;
            }
        }
    }
    return envConfig;
};
export const nonEmptyOrNull = (value) => {
    return value ? value : null;
};
/**
 * Efficiently insert multiple rows. If preventDuplicatesByFirstColumn is true, the first
 * column should be unique (PK or UNIQUE).
 */
export const insertMultipleRows = (rows, table, columnNames, preventDuplicates = true) => __awaiter(void 0, void 0, void 0, function* () {
    if (rows.length === 0) {
        return 0;
    }
    const insertPlaceholders = generate2DPlaceholders(columnNames.length, rows.length);
    const knex = getKnexDb();
    const onConfict = preventDuplicates && !isMysql(knex) ? `ON CONFLICT DO NOTHING` : "";
    yield knex.raw(`INSERT ${isMysql(knex) ? "IGNORE" : ""} INTO ${table} (${columnNames.join(",")}) VALUES ${insertPlaceholders} ${onConfict}`, rows.flat());
    return rows.length;
});
/**
 * Insert a single row and return the autoincremented ID.
 */
export const insertAutoincrementRow = (row, table, columnNames) => __awaiter(void 0, void 0, void 0, function* () {
    const data = columnNames.reduce((obj, columnName, index) => {
        obj[columnName] = row[index];
        return obj;
    }, {});
    const result = yield getKnexDb().insert(data).into(table);
    return result ? Number(result) : null;
});
export const deleteMultipleRowsKnex = (keys, table, keyColumnName) => __awaiter(void 0, void 0, void 0, function* () {
    if (keys.length === 0) {
        return;
    }
    yield getKnexDb().from(table).whereIn(keyColumnName, keys).del();
});
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
