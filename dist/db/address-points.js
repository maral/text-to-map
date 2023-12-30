var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { AddressPointType, createSingleLineAddress } from "czech-address";
import { SeriesType, isNegativeSeriesSpec, isRange, isSeriesSpecArray, } from "../street-markdown/types";
import { findClosestString } from "../utils/helpers";
import jtsk2wgs84 from "../utils/jtsk2wgs84";
import { extractKeyValuesPairs, generate2DPlaceholders, getKnexDb, insertMultipleRows, isMysql, isSqlite, nonEmptyOrNull, rawQuery, } from "./db";
import { getFounderCityCode } from "./founders";
import { MunicipalityType } from "./types";
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
export const commitAddressPoints = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    if (buffer.length === 0) {
        return 0;
    }
    yield insertCities(buffer);
    yield insertDistricts(buffer);
    yield insertMunicipalityParts(buffer);
    yield insertStreets(buffer);
    yield insertPragueDistricts(buffer);
    const params = [];
    buffer.forEach((data) => {
        let latOrNull, lonOrNull;
        latOrNull = null;
        lonOrNull = null;
        if (data[Column.xCoordinate] && data[Column.yCoordinate]) {
            const { lat, lon } = jtsk2wgs84(parseFloat(data[Column.xCoordinate]), parseFloat(data[Column.yCoordinate]));
            [latOrNull, lonOrNull] = [lat.toString(), lon.toString()];
        }
        params.push(data[Column.admCode], nonEmptyOrNull(data[Column.streetCode]), ObjectTypes[data[Column.objectType]], nonEmptyOrNull(data[Column.houseNumber]), nonEmptyOrNull(data[Column.orientationalNumber]), nonEmptyOrNull(data[Column.orientationalNumberLetter]), data[Column.cityCode], nonEmptyOrNull(data[Column.districtCode]), nonEmptyOrNull(data[Column.municipalityPartCode]), nonEmptyOrNull(data[Column.pragueDistrictCode]), data[Column.postalCode], nonEmptyOrNull(data[Column.xCoordinate]), nonEmptyOrNull(data[Column.yCoordinate]), latOrNull, lonOrNull);
    });
    const placeHolders = generate2DPlaceholders(columnNames.length, buffer.length);
    const knex = getKnexDb();
    yield rawQuery(`INSERT ${isMysql(knex) ? "IGNORE" : ""} INTO address_point (${columnNames.join(",")}) VALUES ${placeHolders} ${!isMysql(knex) ? "ON CONFLICT (id) DO NOTHING" : ""}`, params);
    return buffer.length;
});
export const insertCities = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, Column.cityCode, [Column.cityName]), "city", ["code", "name"]);
});
export const insertDistricts = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, Column.districtCode, [
        Column.cityCode,
        Column.districtName,
    ]), "city_district", ["code", "city_code", "name"]);
});
export const insertMunicipalityParts = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, Column.municipalityPartCode, [
        Column.municipalityPartName,
        Column.cityCode,
    ]), "municipality_part", ["code", "name", "city_code"]);
});
export const insertPragueDistricts = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, Column.pragueDistrictCode, [
        Column.pragueDistrictName,
    ]), "prague_district", ["code", "name"]);
});
export const insertStreets = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, Column.streetCode, [
        Column.cityCode,
        Column.streetName,
    ]), "street", ["code", "city_code", "name"]);
});
export const areAddressPointsSynced = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield getKnexDb()
        .count("*", { as: "countAll" })
        .from("address_point")
        .first();
    return Number(result.countAll) >= 2900000; // total is almost 3 million
});
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
export const getAddressPointById = (addressPointId) => __awaiter(void 0, void 0, void 0, function* () {
    const row = yield rawQuery(`${addressPointSelect}
      WHERE a.id = ?`, [addressPointId]);
    if (row.length === 0) {
        return null;
    }
    return rowToAddressPoint(row[0]);
});
let lastFounder = null;
let allStreets = [];
export const checkStreetExists = (streetName, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb();
    const errors = [];
    // we check the whole city
    const cityCode = yield getFounderCityCode(founder);
    const rowList = yield rawQuery(`SELECT name AS street_name
    FROM street
    WHERE city_code = ? AND name = ?  ${isSqlite(knex) ? "COLLATE NOCASE" : ""}`, [cityCode, streetName]);
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
        allStreets = yield getAllStreets(cityCode);
        lastFounder = founder;
    }
    const match = allStreets.find((s) => s.toLocaleLowerCase("cs-CZ") === streetName.toLocaleLowerCase("cs-CZ"));
    let exists = false;
    if (match) {
        exists = true;
        if (streetName !== match) {
            // errors.push(
            //   `Street '${streetName}' has wrong case, correct case: '${match}'.`
            // );
        }
    }
    else {
        const closest = findClosestString(streetName, allStreets);
        errors.push({
            message: `Ulice '${streetName}' v této obci neexistuje, mysleli jste '${closest}'?`,
            startOffset: 0,
            endOffset: streetName.length + 1,
        });
    }
    return { exists: false, errors };
});
const getAllStreets = (cityCode) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb();
    return yield knex.pluck("name").from("street").where("city_code", cityCode);
});
export const findAddressPoints = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb();
    const queryParams = getQueryParams(params);
    const streetJoinCondition = getStreetJoinCondition(params);
    const whereCondition = getWhereCondition(params);
    const queryResult = yield rawQuery(`SELECT a.id, s.name AS street_name, o.name AS object_type_name, a.descriptive_number,
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
    WHERE ${whereCondition}`, queryParams);
    return filterAddressPoints(queryResult.map(rowToAddressPoint), params);
});
export const filterAddressPoints = (addressPoints, params) => {
    if (params.type === "wholeMunicipality" ||
        params.type === "wholeMunicipalityNoStreetName" ||
        params.type === "wholeMunicipalityPart") {
        return addressPoints;
    }
    const result = [];
    const numberSpec = params.smdLine.numberSpec;
    if (isSeriesSpecArray(numberSpec)) {
        numberSpec.forEach((seriesSpec) => {
            result.push(...filterAddressPointsByRanges(addressPoints, seriesSpec));
        });
        // when no number specs are present, we take everything
        if (numberSpec.length === 0) {
            result.push(...addressPoints);
        }
    }
    else if (isNegativeSeriesSpec(numberSpec)) {
        // negative number spec (e.g. odd numbers except 13-17)
        const toExclude = filterAddressPointsByRanges(addressPoints, numberSpec);
        result.push(...addressPoints.filter((addressPoint) => !toExclude.includes(addressPoint)));
    }
    return result;
};
const filterAddressPointsByRanges = (addressPoints, seriesSpec) => {
    const result = [];
    seriesSpec.ranges.forEach((range) => {
        result.push(...addressPoints.filter((addressPoint) => {
            var _a;
            if (isRange(range)) {
                const number = getNumberByType(seriesSpec.type, addressPoint);
                return (isInRange(number, seriesSpec.type !== SeriesType.Description
                    ? (_a = addressPoint.orientationalNumberLetter) !== null && _a !== void 0 ? _a : null
                    : null, range) && fitsType(number, seriesSpec.type));
            }
            else {
                const fullStreetNumber = range;
                return equalsFullStreetNumber(fullStreetNumber, addressPoint);
            }
        }));
    });
    // when no series specs are present, we take everything that fits the type
    if (seriesSpec.ranges.length === 0) {
        result.push(...addressPoints.filter((addressPoint) => fitsType(getNumberByType(seriesSpec.type, addressPoint), seriesSpec.type)));
    }
    return result;
};
export const getQueryParams = (params) => {
    if (params.type === "smdLine" && params.smdLine.type === "street") {
        return [params.smdLine.street, params.municipality.code];
    }
    if ((params.type === "smdLine" && params.smdLine.type === "municipalityPart") ||
        params.type === "wholeMunicipalityPart") {
        return [params.municipalityPartCode];
    }
    return [params.municipality.code];
};
export const getStreetJoinCondition = (params) => {
    if (params.type === "smdLine" && params.smdLine.type === "street") {
        return `JOIN street s ON a.street_code = s.code AND s.name = ? ${isSqlite(getKnexDb()) ? "COLLATE NOCASE" : ""}`;
    }
    return "LEFT JOIN street s ON a.street_code = s.code";
};
export const getWhereCondition = (params) => {
    if ((params.type === "smdLine" && params.smdLine.type === "municipalityPart") ||
        params.type === "wholeMunicipalityPart") {
        return "a.municipality_part_code = ?";
    }
    if (params.type === "wholeMunicipalityNoStreetName") {
        return `${getMunicipalityWhere("a", params.municipality)} AND a.street_code IS NULL`;
    }
    return getMunicipalityWhere("a", params.municipality);
};
export const isInRange = (number, letter, range) => {
    if (number === null) {
        return !range.from && !range.to;
    }
    // explainer: either the lower bound is not set, or it is lower than the number
    // if it's equal to the number, we also have to check the letter - if it's not set, we don't care
    // if from.letter is set, we need to have a letter set and it has to be greater or equal:
    // number without letter counts lower than number with letter 'a' (e.g. 23 < 23a)
    const satisfiesFrom = !range.from ||
        number > range.from.number ||
        (number === range.from.number &&
            (!range.from.letter || (!!letter && letter >= range.from.letter)));
    const satisfiesTo = !range.to ||
        number < range.to.number ||
        (number === range.to.number &&
            (!letter ||
                (!!range.to.letter && !!letter && letter <= range.to.letter)));
    return satisfiesFrom && satisfiesTo;
};
export const fitsType = (number, type) => {
    return (type === SeriesType.Description ||
        type === SeriesType.All ||
        (type === SeriesType.Odd && number % 2 === 1) ||
        (type === SeriesType.Even && number % 2 === 0));
};
export const equalsFullStreetNumber = (fullStreetNumber, addressPoint) => {
    return (fullStreetNumber.descriptionNumber.number === addressPoint.houseNumber &&
        fullStreetNumber.orientationalNumber.number ===
            addressPoint.orientationalNumber &&
        ((!fullStreetNumber.orientationalNumber.letter &&
            !addressPoint.orientationalNumberLetter) ||
            fullStreetNumber.orientationalNumber.letter ===
                addressPoint.orientationalNumberLetter));
};
const getNumberByType = (type, addressPoint) => {
    var _a;
    return type === SeriesType.Description
        ? addressPoint.houseNumber
        : (_a = addressPoint.orientationalNumber) !== null && _a !== void 0 ? _a : null;
};
const getMunicipalityWhere = (alias, municipality) => {
    return municipality.type === MunicipalityType.City
        ? `${alias}.city_code = ?`
        : `${alias}.city_district_code = ?`;
};
const rowToAddressPoint = (row) => {
    const point = {
        id: row.id,
        address: "",
        type: row.object_type_name === DescriptiveType
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
