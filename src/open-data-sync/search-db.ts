import Database from "better-sqlite3";
import { existsSync, copyFileSync } from "fs";
import jtsk2wgs84 from "@arodax/jtsk2wgs84";
import { join } from "path";
import { Founder, MunicipalityType, School } from "./models";
import { extractCityOrDistrictName as extractMunicipalityName } from "../utils/helpers";

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
  verbose?: boolean;
}

const defaults = {
  filePath: "address_points.db",
  initFilePath: join("src", "address_points_init.db"),
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

  const params: (string | null)[] = [];
  buffer.forEach((data) => {
    let latOrNull: string, lonOrNull: string;
    latOrNull = null;
    lonOrNull = null;
    if (data[Column.xCoordinate] && data[Column.yCoordinate]) {
      const { lat, lon } = jtsk2wgs84(
        parseFloat(data[Column.xCoordinate]),
        parseFloat(data[Column.yCoordinate])
      );
      [latOrNull, lonOrNull] = [lat.toString(), lon.toString()];
    }

    params.push(
      data[Column.admCode],
      nonEmptyOrNull(data[Column.streetCode]),
      ObjectTypes[data[Column.objectType]],
      nonEmptyOrNull(data[Column.houseNumber]),
      nonEmptyOrNull(data[Column.orientingNumber]),
      nonEmptyOrNull(data[Column.orientingNumberLetter]),
      data[Column.cityCode],
      nonEmptyOrNull(data[Column.districtCode]),
      nonEmptyOrNull(data[Column.xCoordinate]),
      nonEmptyOrNull(data[Column.yCoordinate]),
      latOrNull,
      lonOrNull
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
 * Efficiently insert multiple rows. If preventDuplicatesByFirstColumn is true, the first
 * column should be unique (PK or UNIQUE).
 */
const _insertMultipleRows = (
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

const clearDuplicates = (
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

export const insertSchools = (schools: School[]): number => {
  const insertedSchools = _insertMultipleRows(
    schools.map((school) => [
      school.izo,
      school.name,
      school.capacity.toString(),
    ]),
    "school",
    ["izo", "name", "capacity"]
  );

  const locations = schools.flatMap((school) => {
    const uniqueAddressPoints = [
      ...new Set(school.locations.map((location) => location.addressPointId)),
    ];
    return uniqueAddressPoints.map((addressPoint) => [
      school.izo,
      addressPoint.toString(),
    ]);
  });

  let insertedLocations = 0;
  // @todo prevent FK errors (address point might not exist, maybe even school?) - or maybe the DB wasn't fresh

  // plus filter out duplicit locations (same address id + izo)
  locations.forEach((location) => {
    try {
      insertedLocations += _insertMultipleRows(
        [location],
        "school_location",
        ["school_izo", "address_point_id"],
        false
      );
    } catch (error) {
      console.log(
        `Cannot add location with RUIAN code ${location[1]}: code does not exist.`
      );
    }
  });

  return insertedSchools + insertedLocations;
};

export const insertFounders = (founders: Founder[]): number => {
  const db = getDb();
  const selectCityNameStatement = db.prepare(
    `SELECT c.name FROM school s
    JOIN school_location l ON s.izo = l.school_izo
    JOIN address_point a ON l.address_point_id = a.id
    JOIN city c ON a.city_code = c.code
    WHERE s.izo = ?
    LIMIT 1`
  );

  const selectDistrictNameStatement = db.prepare(
    `SELECT d.name FROM school s
    JOIN school_location l ON s.izo = l.school_izo
    JOIN address_point a ON l.address_point_id = a.id
    JOIN city_district d ON a.city_district_code = d.code
    WHERE s.izo = ?
    LIMIT 1`
  );

  let correct = 0;
  let incorrect = 0;
  founders.forEach((founder) => {
    if (
      founder.municipalityType !== MunicipalityType.City &&
      founder.municipalityType !== MunicipalityType.District
    ) {
      return;
    }
    const municipalityName = extractMunicipalityName(founder);

    founder.schools.forEach((school) => {
      const name = (
        founder.municipalityType === MunicipalityType.City
          ? selectCityNameStatement
          : selectDistrictNameStatement
      )
        .pluck()
        .get(school.izo);
      const isEqual = name === municipalityName;
      correct += isEqual ? 1 : 0;
      incorrect += isEqual ? 0 : 1;
      if (!isEqual) {
        console.log(
          `izo: ${school.izo}, extracted: ${municipalityName}, RUIAN: ${name}`
        );
      }
    });
  });
  console.log(`Correct municipality names: ${correct}`);
  console.log(`Incorrect municipality names: ${incorrect}`);

  return 0;
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
