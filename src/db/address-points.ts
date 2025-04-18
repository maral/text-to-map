import { AddressPointType, createSingleLineAddress } from "czech-address";
import {
  AddressPoint,
  FullStreetNumber,
  RangeSpec,
  SeriesSpec,
  SeriesType,
  SmdError,
  SmdLine,
  isNegativeSeriesSpec,
  isRange,
  isSeriesSpecArray,
} from "../street-markdown/types";
import { findClosestString, roundToNDecimalPlaces } from "../utils/helpers";
import jtsk2wgs84 from "../utils/jtsk2wgs84";
import {
  extractKeyValuesPairs,
  generate2DPlaceholders,
  getKnexDb,
  insertMultipleRows,
  isMysql,
  isSqlite,
  nonEmptyOrNull,
  rawQuery,
} from "./db";
import { getFounderCityCode } from "./founders";
import { Founder, Municipality, MunicipalityType } from "./types";
import chunk from "lodash/chunk";

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

const columnNames = [
  "id",
  "street_code",
  "object_type_id",
  "descriptive_number",
  "orientational_number",
  "orientational_number_letter",
  "city_code",
  "city_district_code",
  "municipality_part_code",
  "prague_district_code",
  "postal_code",
  "jtsk_x",
  "jtsk_y",
  "wgs84_latitude",
  "wgs84_longitude",
];

export const commitAddressPoints = async (
  buffer: string[][]
): Promise<number> => {
  if (buffer.length === 0) {
    return 0;
  }
  await insertCities(buffer);
  await insertDistricts(buffer);
  await insertMunicipalityParts(buffer);
  await insertStreets(buffer);
  await insertPragueDistricts(buffer);

  const params: Record<string, (string | null)[]> = {};
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
    params[data[Column.admCode]] = [
      data[Column.admCode],
      nonEmptyOrNull(data[Column.streetCode]),
      ObjectTypes[data[Column.objectType]],
      nonEmptyOrNull(data[Column.houseNumber]),
      nonEmptyOrNull(data[Column.orientationalNumber]),
      nonEmptyOrNull(data[Column.orientationalNumberLetter]),
      data[Column.cityCode],
      nonEmptyOrNull(data[Column.districtCode]),
      nonEmptyOrNull(data[Column.municipalityPartCode]),
      nonEmptyOrNull(data[Column.pragueDistrictCode]),
      data[Column.postalCode],
      nonEmptyOrNull(data[Column.xCoordinate]),
      nonEmptyOrNull(data[Column.yCoordinate]),
      latOrNull,
      lonOrNull,
    ];
  });

  // find already existing rows
  const existingRows = await rawQuery(
    `SELECT * FROM address_point WHERE id IN (${buffer
      .map((data) => data[Column.admCode])
      .join(",")})`
  );

  const queries = [];
  for (const row of existingRows) {
    const toInsert = params[row.id];
    const values = Object.values(row);
    if (!toInsert.every((v, i) => valuesEqual(v, values[i]))) {
      // update those whose values differ
      queries.push(
        rawQuery(
          `UPDATE address_point SET ${columnNames
            .map((c) => `${c} = ?`)
            .join(", ")} WHERE id = ?`,
          [...toInsert, row.id]
        )
      );
    }
  }

  await Promise.all(queries);

  const placeHolders = generate2DPlaceholders(
    columnNames.length,
    buffer.length
  );

  const knex = getKnexDb();
  await rawQuery(
    `INSERT ${
      isMysql(knex) ? "IGNORE" : ""
    } INTO address_point (${columnNames.join(",")}) VALUES ${placeHolders} ${
      !isMysql(knex) ? "ON CONFLICT (id) DO NOTHING" : ""
    }`,
    Object.values(params).flat()
  );

  return buffer.length;
};

export async function removeDeprecatedAddressPoints(
  allIds: Set<number>
): Promise<void> {
  const knex = getKnexDb();
  const existingIds = await knex.pluck("id").from("address_point");
  const toRemove = existingIds.filter((id) => !allIds.has(id));
  const chunks = chunk(toRemove, 1000);
  for (const chunk of chunks) {
    await knex("address_point").whereIn("id", chunk).delete();
  }
  console.log(`Removed ${toRemove.length} deprecated address points.`);
}

function valuesEqual(a: any, b: any): boolean {
  return sanitizeValue(a) === sanitizeValue(b);
}

function sanitizeValue(value: any): any {
  if (value === null) {
    return null;
  }
  value = value.toString();

  if (/\d+\.\d+/.test(value)) {
    return roundToNDecimalPlaces(parseFloat(value), 6).toString();
  }
  return value;
}

export const insertCities = async (buffer: string[][]): Promise<number> => {
  return await insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.cityCode, [Column.cityName]),
    "city",
    ["code", "name"]
  );
};

export const insertDistricts = async (buffer: string[][]): Promise<number> => {
  return await insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.districtCode, [
      Column.cityCode,
      Column.districtName,
    ]),
    "city_district",
    ["code", "city_code", "name"]
  );
};

export const insertMunicipalityParts = async (
  buffer: string[][]
): Promise<number> => {
  return await insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.municipalityPartCode, [
      Column.municipalityPartName,
      Column.cityCode,
    ]),
    "municipality_part",
    ["code", "name", "city_code"]
  );
};

export const insertPragueDistricts = async (
  buffer: string[][]
): Promise<number> => {
  return await insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.pragueDistrictCode, [
      Column.pragueDistrictName,
    ]),
    "prague_district",
    ["code", "name"]
  );
};

export const insertStreets = async (buffer: string[][]): Promise<number> => {
  return await insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.streetCode, [
      Column.cityCode,
      Column.streetName,
    ]),
    "street",
    ["code", "city_code", "name"]
  );
};

export const areAddressPointsSynced = async (): Promise<boolean> => {
  const result = await getKnexDb()
    .count("*", { as: "countAll" })
    .from("address_point")
    .first();
  return Number(result.countAll) >= 2900000; // total is almost 3 million
};

const addressPointSelect = `
  SELECT a.id, s.name AS street_name, o.name AS object_type_name, a.descriptive_number,
        a.orientational_number, a.orientational_number_letter, c.name AS city_name,
        m.name AS municipality_part_name, p.name AS prague_district_name,
        d.name AS district_name, a.postal_code, a.wgs84_latitude, a.wgs84_longitude
  FROM address_point a
  LEFT JOIN street s ON a.street_code = s.code
  INNER JOIN object_type o ON o.id = a.object_type_id
  INNER JOIN city c ON c.code = a.city_code
  LEFT JOIN city_district d ON a.city_district_code = d.code
  LEFT JOIN prague_district p ON a.prague_district_code = p.code
  LEFT JOIN municipality_part m ON a.municipality_part_code = m.code`;

export const getAddressPointById = async (
  addressPointId: number
): Promise<AddressPoint | null> => {
  const row = await rawQuery(
    `${addressPointSelect}
      WHERE a.id = ?`,
    [addressPointId]
  );
  if (row.length === 0) {
    return null;
  }
  return rowToAddressPoint(row[0]);
};

let lastFounder: Founder | null = null;
let allStreets: string[] = [];

export const checkStreetExists = async (
  streetName: string,
  founder: Founder
): Promise<{ exists: boolean; errors: SmdError[] }> => {
  const knex = getKnexDb();
  const errors: SmdError[] = [];

  // we check the whole city
  const cityCode = await getFounderCityCode(
    founder.municipalityType,
    founder.municipalityCode
  );
  const rowList = await rawQuery(
    `SELECT name AS street_name
    FROM street
    WHERE city_code = ? AND name = ?  ${
      isSqlite(knex) ? "COLLATE NOCASE" : ""
    }`,
    [cityCode, streetName]
  );

  if (rowList.length > 0) {
    const row = rowList[0];
    if (row.street_name !== streetName) {
      // errors.push(
      //   `Street '${streetName}' has wrong case, correct case: '${row.street_name}'.`
      // );
    }
    return { exists: true, errors };
  }

  if (lastFounder !== founder) {
    allStreets = await getAllStreets(cityCode);
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
  } else {
    const closest = findClosestString(streetName, allStreets);
    errors.push({
      message: `Ulice '${streetName}' v této obci neexistuje, mysleli jste '${closest}'?`,
      startOffset: 0,
      endOffset: streetName.length + 1,
    });
  }
  return { exists: false, errors };
};

const getAllStreets = async (cityCode: number): Promise<string[]> => {
  const knex = getKnexDb();
  return await knex.pluck("name").from("street").where("city_code", cityCode);
};

export type FindAddressPointsParams =
  | {
      type: "smdLine";
      smdLine: SmdLine;
      municipality: Municipality;
      municipalityPartCode?: number;
    }
  | {
      type: "wholeMunicipalityPart";
      municipalityPartCode: number;
    }
  | {
      type: "wholeMunicipality";
      municipality: Municipality;
    }
  | {
      type: "wholeMunicipalityNoStreetName";
      municipality: Municipality;
    };

export const findAddressPoints = async (
  params: FindAddressPointsParams
): Promise<AddressPoint[]> => {
  const queryParams = getQueryParams(params);
  const streetJoinCondition = getStreetJoinCondition(params);

  const whereCondition = getWhereCondition(params);

  const queryResult = await rawQuery(
    `SELECT a.id, s.name AS street_name, o.name AS object_type_name, a.descriptive_number,
      a.orientational_number, a.orientational_number_letter, c.name AS city_name,
      d.name AS district_name, m.name AS municipality_part_name, p.name AS prague_district_name,
      a.postal_code, a.wgs84_latitude, a.wgs84_longitude
    FROM address_point a
    ${streetJoinCondition}
    INNER JOIN object_type o ON o.id = a.object_type_id
    INNER JOIN city c ON c.code = a.city_code
    LEFT JOIN city_district d ON a.city_district_code = d.code
    LEFT JOIN municipality_part m ON a.municipality_part_code = m.code
    LEFT JOIN prague_district p ON a.prague_district_code = p.code
    WHERE ${whereCondition}`,
    queryParams
  );

  return filterAddressPoints(queryResult.map(rowToAddressPoint), params);
};

export const filterAddressPoints = (
  addressPoints: AddressPoint[],
  params: FindAddressPointsParams
): AddressPoint[] => {
  if (
    params.type === "wholeMunicipality" ||
    params.type === "wholeMunicipalityNoStreetName" ||
    params.type === "wholeMunicipalityPart"
  ) {
    return addressPoints;
  }

  const result: AddressPoint[] = [];
  const numberSpec = params.smdLine.numberSpec;
  if (isSeriesSpecArray(numberSpec)) {
    numberSpec.forEach((seriesSpec) => {
      result.push(...filterAddressPointsByRanges(addressPoints, seriesSpec));
    });

    // when no number specs are present, we take everything
    if (numberSpec.length === 0) {
      result.push(...addressPoints);
    }
  } else if (isNegativeSeriesSpec(numberSpec)) {
    // negative number spec (e.g. odd numbers except 13-17)
    const toExclude = filterAddressPointsByRanges(addressPoints, numberSpec);
    result.push(
      ...addressPoints.filter(
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
              seriesSpec.type !== SeriesType.Description
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

export const getQueryParams = (
  params: FindAddressPointsParams
): (string | number)[] => {
  if (params.type === "smdLine" && params.smdLine.type === "street") {
    return [params.smdLine.street, params.municipality.code];
  }

  if (
    (params.type === "smdLine" && params.smdLine.type === "municipalityPart") ||
    params.type === "wholeMunicipalityPart"
  ) {
    return [params.municipalityPartCode];
  }

  return [params.municipality.code];
};

export const getStreetJoinCondition = (
  params: FindAddressPointsParams
): string => {
  if (params.type === "smdLine" && params.smdLine.type === "street") {
    return `JOIN street s ON a.street_code = s.code AND s.name = ? ${
      isSqlite(getKnexDb()) ? "COLLATE NOCASE" : ""
    }`;
  }
  return "LEFT JOIN street s ON a.street_code = s.code";
};

export const getWhereCondition = (params: FindAddressPointsParams): string => {
  if (
    (params.type === "smdLine" && params.smdLine.type === "municipalityPart") ||
    params.type === "wholeMunicipalityPart"
  ) {
    return "a.municipality_part_code = ?";
  }

  if (params.type === "wholeMunicipalityNoStreetName") {
    return `${getMunicipalityWhere(
      "a",
      params.municipality
    )} AND a.street_code IS NULL`;
  }

  return getMunicipalityWhere("a", params.municipality);
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
    type === SeriesType.Description ||
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
    fullStreetNumber.descriptionNumber.number === addressPoint.houseNumber &&
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
  return type === SeriesType.Description
    ? addressPoint.houseNumber
    : addressPoint.orientationalNumber ?? null;
};

const getMunicipalityWhere = (
  alias: string,
  municipality: Municipality
): string => {
  return municipality.type === MunicipalityType.City
    ? `${alias}.city_code = ?`
    : `${alias}.city_district_code = ?`;
};

const rowToAddressPoint = (row: any): AddressPoint => {
  const point: AddressPoint = {
    id: row.id,
    address: "",
    type:
      row.object_type_name === DescriptiveType
        ? AddressPointType.Description
        : AddressPointType.Registration,
    houseNumber: row.descriptive_number,
    city: row.city_name,
    municipalityPart: row.municipality_part_name,
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
  if (row.prague_district_name !== null) {
    point.pragueDistrict = row.prague_district_name;
  }
  point.address = createSingleLineAddress(point);
  return point;
};
