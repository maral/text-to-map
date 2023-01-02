import Database from "better-sqlite3";
import { existsSync, copyFileSync } from "fs";
import jtsk2wgs84 from "@arodax/jtsk2wgs84";
import { join } from "path";

const buffer: string[][] = [];
const MaxBufferSize = 1000;
let _db: Database.Database;

const ObjectTypes = {
  "č.p.": 1,
  "č.ev.": 2,
};

export const Column = {
  admCode: 0,
  cityCode: 1,
  cityName: 2,
  districtCode: 3,
  districtName: 4,
  pragueDistrictCode: 5,
  pragueDistrictName: 6,
  cityPartCode: 7,
  cityPartName: 8,
  streetCode: 9,
  streetName: 10,
  objectType: 11,
  houseNumber: 12,
  orientingNumber: 13,
  orientingNumberLetter: 14,
  postalCode: 15,
  yCoordinate: 16,
  xCoordinate: 17,
  validFrom: 18,
};

interface DbConfig {
  initFilePath?: string;
  filePath?: string;
}

export interface SchoolLocation {
  id?: number;
  schoolId?: number;
  addressPointId: number;
}

export interface School {
  id?: number;
  name: string;
  izo: string;
  locations: SchoolLocation[];
}

const defaults = {
  filePath: "address_points.db",
  initFilePath: join("src", "address_points_init.db"),
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

    _db = new Database(options.filePath); //, { verbose: console.log });
    _db.pragma("journal_mode = WAL");
  }

  return _db;
};

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

export const importParsedLine = (data: string[]) => {
  buffer.push(data);
  if (buffer.length >= MaxBufferSize) {
    return commitAddressPoints();
  }
  return 0;
};

export const commitAddressPoints = (): number => {
  if (buffer.length === 0) {
    return 0;
  }
  insertCities(buffer);
  insertDistricts(buffer);
  insertStreets(buffer);

  const db = getDb();

  const placeHolders = new Array(buffer.length)
    .fill("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .join(", ");

  const insertStatement = db.prepare(
    `INSERT OR IGNORE INTO address_point
      (id, street_code, object_type_id, house_number, orienting_number, orienting_number_letter, city_code, city_district_code, jtsk_x, jtsk_y, wgs84_latitude, wgs84_longitude)
      VALUES ${placeHolders}`
  );

  const params = [];
  buffer.forEach((data) => {
    const { lat, lon } = jtsk2wgs84(
      parseFloat(data[Column.xCoordinate]),
      parseFloat(data[Column.yCoordinate])
    );

    params.push(
      data[Column.admCode],
      nonEmptyOrNull(data[Column.streetCode]),
      ObjectTypes[data[Column.objectType]],
      nonEmptyOrNull(data[Column.houseNumber]),
      nonEmptyOrNull(data[Column.orientingNumber]),
      nonEmptyOrNull(data[Column.orientingNumberLetter]),
      data[Column.cityCode],
      nonEmptyOrNull(data[Column.districtCode]),
      data[Column.xCoordinate],
      data[Column.yCoordinate],
      lat,
      lon
    );
  });

  buffer.length = 0;
  return insertStatement.run(params).changes;
};

export const insertCities = (buffer: string[][]): number => {
  return _insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.cityCode, [Column.cityName]),
    "city",
    ["code", "name"]
  );
};

export const insertDistricts = (buffer: string[][]): number => {
  return _insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.districtCode, [
      Column.cityCode,
      Column.districtName,
    ]),
    "city_district",
    ["code", "city_code", "name"]
  );
};

export const insertStreets = (buffer: string[][]): number => {
  return _insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.streetCode, [
      Column.cityCode,
      Column.districtCode,
      Column.streetName,
    ]),
    "street",
    ["code", "city_code", "city_district_code", "name"]
  );
};

const nonEmptyOrNull = (value: string): string | null => {
  return value ? value : null;
};

/**
 * Effectively insert multiple rows.
 * @param rows object with primary keys as keys, array with the rest of the columns as values
 * @param table table name
 * @param columnNames column names
 * @returns number of inserted rows
 */
const _insertMultipleRows = (
  rows: object,
  table: string,
  columnNames: string[]
): number => {
  const db = getDb();

  if (Object.keys(rows).length === 0) {
    return 0;
  }

  const selectPlaceholders = generatePlaceholders(Object.keys(rows).length);

  const selectStatement = db.prepare(
    `SELECT ${columnNames[0]} FROM ${table} WHERE ${columnNames[0]} IN (${selectPlaceholders})`
  );

  const existing = selectStatement.pluck().all(Object.keys(rows));
  existing.forEach((key) => {
    delete rows[key];
  });

  if (Object.keys(rows).length === 0) {
    return 0;
  }
  const insertPlaceholders = generateRepetitiveString(
    `(${generatePlaceholders(columnNames.length)})`,
    ",",
    Object.keys(rows).length
  );

  const insertStatement = db.prepare(
    `INSERT INTO ${table} (${columnNames.join(
      ","
    )}) VALUES ${insertPlaceholders}`
  );

  const values = [];
  Object.keys(rows).forEach((key: string) => {
    values.push(key, ...rows[key]);
  });
  return insertStatement.run(values).changes;
};

export const insertSchool = (school: School) => {
  const db = getDb();

  const insertSchoolStatement = db.prepare(
    `INSERT INTO school (izo, name) VALUES  (?, ?)`
  );

  const insertSchoolLocationStatement = db.prepare(
    `INSERT INTO school_location (school_id, address_point_id) VALUES  (?, ?)`
  );

  const result = insertSchoolStatement.run(school.izo, school.name);

  school.locations.forEach((location) => {
    insertSchoolLocationStatement.run(
      result.lastInsertRowid,
      location.addressPointId
    );
  });

  return result.changes;
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

const generatePlaceholders = (n: number): string => {
  return generateRepetitiveString("?", ",", n);
};

export const extractKeyValuesPairs = (
  array: string[][],
  keyIndex: number,
  valuesIndices: number[]
): object => {
  return array.reduce((acc: object, data: string[]) => {
    if (data[keyIndex]) {
      acc[data[keyIndex]] = valuesIndices.map((index: number) =>
        nonEmptyOrNull(data[index])
      );
    }
    return acc;
  }, {});
};
