import {
  extractKeyValuesPairs,
  getDb,
  insertMultipleRows,
  nonEmptyOrNull,
} from "./db";
import jtsk2wgs84 from "@arodax/jtsk2wgs84";
import {
  AddressPoint,
  AddressPointType,
  FullStreetNumber,
  isNegativeSeriesSpec,
  isRange,
  isSeriesSpecArray,
  RangeSpec,
  SeriesSpec,
  SeriesType,
  SmdLine,
} from "../street-markdown/types";
import { Founder, MunicipalityType } from "./types";
import { findClosestString } from "../utils/helpers";
import { getFounderCityCode } from "./founders";

const buffer: string[][] = [];
const MaxBufferSize = 1000;

const DescriptiveType = "č.p.";
const RegistrationType = "č.ev.";

const ObjectTypes = {
  [DescriptiveType]: 1,
  [RegistrationType]: 2,
};

export const Column = {
  admCode: 0,
  cityCode: 1,
  cityName: 2,
  districtCode: 3,
  districtName: 4,
  pragueDistrictCode: 5,
  pragueDistrictName: 6,
  municipalityPartCode: 7,
  municipalityPartName: 8,
  streetCode: 9,
  streetName: 10,
  objectType: 11,
  houseNumber: 12,
  orientationalNumber: 13,
  orientationalNumberLetter: 14,
  postalCode: 15,
  yCoordinate: 16,
  xCoordinate: 17,
  validFrom: 18,
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
  insertMunicipalityParts(buffer);
  insertStreets(buffer);

  const db = getDb();

  const placeHolders = new Array(buffer.length)
    .fill("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .join(", ");

  const insertStatement = db.prepare(
    `INSERT OR IGNORE INTO address_point
      (id, street_code, object_type_id, descriptive_number, orientational_number, orientational_number_letter, city_code, city_district_code, municipality_part_code, postal_code, jtsk_x, jtsk_y, wgs84_latitude, wgs84_longitude)
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
      nonEmptyOrNull(data[Column.orientationalNumber]),
      nonEmptyOrNull(data[Column.orientationalNumberLetter]),
      data[Column.cityCode],
      nonEmptyOrNull(data[Column.districtCode]),
      nonEmptyOrNull(data[Column.municipalityPartCode]),
      data[Column.postalCode],
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
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.cityCode, [Column.cityName]),
    "city",
    ["code", "name"]
  );
};

export const insertDistricts = (buffer: string[][]): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.districtCode, [
      Column.cityCode,
      Column.districtName,
    ]),
    "city_district",
    ["code", "city_code", "name"]
  );
};

export const insertMunicipalityParts = (buffer: string[][]): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.municipalityPartCode, [
      Column.municipalityPartName,
    ]),
    "municipality_part",
    ["code", "name"]
  );
};

export const insertStreets = (buffer: string[][]): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.streetCode, [
      Column.cityCode,
      Column.streetName,
    ]),
    "street",
    ["code", "city_code", "name"]
  );
};

const addressPointSelect = `
  SELECT a.id, s.name AS street_name, o.name AS object_type_name, a.descriptive_number,
        a.orientational_number, a.orientational_number_letter, c.name AS city_name,
        m.name AS municipality_part_name, d.name AS district_name, a.postal_code,
        a.wgs84_latitude, a.wgs84_longitude
  FROM address_point a
  LEFT JOIN street s ON a.street_code = s.code
  INNER JOIN object_type o ON o.id = a.object_type_id
  INNER JOIN city c ON c.code = a.city_code
  LEFT JOIN city_district d ON a.city_district_code = d.code
  LEFT JOIN municipality_part m ON a.municipality_part_code = m.code`;

export const getAddressPointById = (
  addressPointId: number
): AddressPoint | null => {
  const db = getDb();
  const statement = db.prepare(
    `${addressPointSelect}
      WHERE a.id = ?`
  );
  const row = statement.get(addressPointId);
  if (!row) {
    return null;
  }
  return rowToAddressPoint(row);
};

let lastFounder: Founder | null = null;
let allStreets: string[] = [];

export const checkStreetExists = (
  streetName: string,
  founder: Founder
): { exists: boolean; errors: string[] } => {
  const db = getDb();
  const errors = [];

  // we check the whole city
  const cityCode = getFounderCityCode(founder);
  const statement = db.prepare(`
    SELECT name AS street_name
    FROM street
    WHERE city_code = ? AND name = ? COLLATE NOCASE`);

  const row = statement.get(cityCode, streetName);
  if (row) {
    if (row.street_name !== streetName) {
      // errors.push(
      //   `Street '${streetName}' has wrong case, correct case: '${row.street_name}'.`
      // );
    }
    return { exists: true, errors };
  }

  if (lastFounder !== founder) {
    allStreets = getAllStreets(cityCode);
    lastFounder = founder;
  }

  const match = allStreets.find(
    (s) =>
      s.toLocaleLowerCase("cs-CZ") === streetName.toLocaleLowerCase("cs-CZ")
  );
  let exists = false;
  if (match) {
    exists = true;
    if (streetName !== match) {
      // errors.push(
      //   `Street '${streetName}' has wrong case, correct case: '${match}'.`
      // );
    }
    exists = true;
  } else {
    const closest = findClosestString(streetName, allStreets);
    errors.push(
      `Street '${streetName}' does not exist, did you mean '${closest}'?`
    );
  }
  return { exists: false, errors };
};

const getAllStreets = (cityCode: number): string[] => {
  const db = getDb();
  const statement = db.prepare(`
    SELECT s.name AS street_name
    FROM street s
    WHERE city_code = ?`);
  const rows = statement.all(cityCode);
  return rows.map((row) => row.street_name);
};

export const findAddressPoints = (
  smdLine: SmdLine,
  founder: Founder
): AddressPoint[] => {
  const db = getDb();

  const statement = db.prepare(`
    SELECT a.id, s.name AS street_name, o.name AS object_type_name, a.descriptive_number,
          a.orientational_number, a.orientational_number_letter, c.name AS city_name,
          m.name AS municipality_part_name, d.name AS district_name, a.postal_code,
          a.wgs84_latitude, a.wgs84_longitude
    FROM address_point a
    JOIN street s ON a.street_code = s.code AND s.name = ? COLLATE NOCASE
    INNER JOIN object_type o ON o.id = a.object_type_id
    INNER JOIN city c ON c.code = a.city_code
    LEFT JOIN city_district d ON a.city_district_code = d.code
    LEFT JOIN municipality_part m ON a.municipality_part_code = m.code
    WHERE ${getMunicipalityWhere("a", founder)}`);

  const filteredAddressPoints = statement
    .all(smdLine.street, founder.cityOrDistrictCode)
    .map(rowToAddressPoint);

  const result: AddressPoint[] = [];
  const numberSpec = smdLine.numberSpec;
  if (isSeriesSpecArray(numberSpec)) {
    numberSpec.forEach((seriesSpec) => {
      result.push(
        ...filterAddressPointsByRanges(filteredAddressPoints, seriesSpec)
      );
    });

    // when no number specs are present, we take everything
    if (numberSpec.length === 0) {
      result.push(...filteredAddressPoints);
    }
  } else if (isNegativeSeriesSpec(numberSpec)) {
    // negative number spec (e.g. odd numbers except 13-17)
    const toExclude = filterAddressPointsByRanges(
      filteredAddressPoints,
      numberSpec
    );
    result.push(
      ...filteredAddressPoints.filter(
        (addressPoint) => !toExclude.includes(addressPoint)
      )
    );
  }

  return result;
};

const filterAddressPointsByRanges = (
  addressPoints: AddressPoint[],
  seriesSpec: SeriesSpec
): AddressPoint[] => {
  const result: AddressPoint[] = [];
  seriesSpec.ranges.forEach((range) => {
    result.push(
      ...addressPoints.filter((addressPoint) => {
        if (isRange(range)) {
          const number = getNumberByType(seriesSpec.type, addressPoint);
          return (
            isInRange(
              number,
              seriesSpec.type !== SeriesType.Descriptive
                ? addressPoint.orientationalNumberLetter ?? null
                : null,
              range
            ) && fitsType(number, seriesSpec.type)
          );
        } else {
          const fullStreetNumber: FullStreetNumber = range;
          return equalsFullStreetNumber(fullStreetNumber, addressPoint);
        }
      })
    );
  });

  // when no series specs are present, we take everything that fits the type
  if (seriesSpec.ranges.length === 0) {
    result.push(
      ...addressPoints.filter((addressPoint) =>
        fitsType(
          getNumberByType(seriesSpec.type, addressPoint),
          seriesSpec.type
        )
      )
    );
  }

  return result;
};

export const isInRange = (
  number: number | null,
  letter: string | null,
  range: RangeSpec
): boolean => {
  if (number === null) {
    return !range.from && !range.to;
  }

  // explainer: either the lower bound is not set, or it is lower than the number
  // if it's equal to the number, we also have to check the letter - if it's not set, we don't care
  // if from.letter is set, we need to have a letter set and it has to be greater or equal:
  // number without letter counts lower than number with letter 'a' (e.g. 23 < 23a)
  const satisfiesFrom =
    !range.from ||
    number > range.from.number ||
    (number === range.from.number &&
      (!range.from.letter || (!!letter && letter >= range.from.letter)));

  const satisfiesTo =
    !range.to ||
    number < range.to.number ||
    (number === range.to.number &&
      (!letter ||
        (!!range.to.letter && !!letter && letter <= range.to.letter)));

  return satisfiesFrom && satisfiesTo;
};

export const fitsType = (number: number | null, type: SeriesType): boolean => {
  return (
    type === SeriesType.Descriptive ||
    type === SeriesType.All ||
    (type === SeriesType.Odd && number % 2 === 1) ||
    (type === SeriesType.Even && number % 2 === 0)
  );
};

export const equalsFullStreetNumber = (
  fullStreetNumber: FullStreetNumber,
  addressPoint: AddressPoint
): boolean => {
  return (
    fullStreetNumber.descriptiveNumber.number ===
      addressPoint.descriptiveNumber &&
    fullStreetNumber.orientationalNumber.number ===
      addressPoint.orientationalNumber &&
    ((!fullStreetNumber.orientationalNumber.letter &&
      !addressPoint.orientationalNumberLetter) ||
      fullStreetNumber.orientationalNumber.letter ===
        addressPoint.orientationalNumberLetter)
  );
};

const getNumberByType = (
  type: SeriesType,
  addressPoint: AddressPoint
): number | null => {
  return type === SeriesType.Descriptive
    ? addressPoint.descriptiveNumber
    : addressPoint.orientationalNumber ?? null;
};

const getMunicipalityWhere = (alias: string, founder: Founder): string => {
  return founder.municipalityType === MunicipalityType.City
    ? `${alias}.city_code = ?`
    : `${alias}.city_district_code = ?`;
};

const createAddress = (result: any): string => {
  const orientationalPart = result.orientational_number
    ? `/${result.orientational_number}${
        result.orientational_number_letter ?? ""
      }`
    : "";
  return `${result.street_name} ${result.descriptive_number}${orientationalPart}, ${result.city_name}`;
};

const rowToAddressPoint = (row: any): AddressPoint => {
  const point: AddressPoint = {
    id: row.id,
    address: createAddress(row),
    type:
      row.object_type_name === DescriptiveType
        ? AddressPointType.Descriptive
        : AddressPointType.Registration,
    descriptiveNumber: row.descriptive_number,
    city: row.city_name,
    postalCode: row.postal_code,
    lat: row.wgs84_latitude,
    lng: row.wgs84_longitude,
  };
  if (row.street_name !== null) {
    point.street = row.street_name;
  }
  if (row.orientational_number !== null) {
    point.orientationalNumber = row.orientational_number;
  }
  if (row.orientational_number_letter !== null) {
    point.orientationalNumberLetter = row.orientational_number_letter;
  }
  if (row.district_name !== null) {
    point.district = row.district_name;
  }
  if (row.municipality_part_name !== null) {
    point.municipalityPart = row.municipality_part_name;
  }
  return point;
};
