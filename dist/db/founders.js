var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import distance from "@turf/distance";
import { wholeLineError } from "../street-markdown/smd";
import { extractMunicipalityName, findClosestString, sanitizeMunicipalityName, } from "../utils/helpers";
import { getKnexDb, insertAutoincrementRow, insertMultipleRows } from "./db";
import { MunicipalityType, } from "./types";
const cityTypeCode = 261;
const cityDistrictTypeCode = 263;
export const insertFounders = (founders) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    let insertedFounders = 0;
    const schoolFounderConnectionData = [];
    for (const founder of founders) {
        if (founder.municipalityType !== MunicipalityType.City &&
            founder.municipalityType !== MunicipalityType.District) {
            continue;
        }
        const extractedMunicipalityName = extractMunicipalityName(founder);
        // check if the extracted municipality name is the same as in all the schools' locations
        let differingSchools = [];
        let municipalityCode = -1;
        for (const school of founder.schools) {
            const result = yield (founder.municipalityType === MunicipalityType.City
                ? getCityOfSchool(school.izo)
                : getDistrictOfSchool(school.izo));
            if (!result) {
                console.log(`izo: ${school.izo}, extracted: ${extractedMunicipalityName}, RUIAN: UNDEFINED`);
                differingSchools.push(school);
            }
            else {
                const { name, code } = result;
                if (name !== extractedMunicipalityName) {
                    console.log(`izo: ${school.izo}, extracted: ${extractedMunicipalityName}, RUIAN: ${name}`);
                    differingSchools.push(school);
                }
                // store municipalityCode even if the names don't match, we will use it later
                municipalityCode = parseInt(code);
            }
        }
        municipalityCode = yield fixFounderProblems(founder, municipalityCode, differingSchools, extractedMunicipalityName);
        const cityDistrictCode = founder.municipalityType === MunicipalityType.District
            ? municipalityCode.toString()
            : null;
        let cityCode = null;
        if (founder.municipalityType === MunicipalityType.City) {
            cityCode = (_a = municipalityCode === null || municipalityCode === void 0 ? void 0 : municipalityCode.toString()) !== null && _a !== void 0 ? _a : null;
        }
        else {
            cityCode = yield getCityCodeByDistrictCode(municipalityCode);
        }
        const existing = yield getKnexDb()
            .select("*")
            .from("founder")
            .where({
            name: sanitizeMunicipalityName(founder.name),
            ico: founder.ico,
        });
        let founderId = (_c = (_b = existing[0]) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : null;
        if (existing.length === 0) {
            founderId = yield insertAutoincrementRow([
                sanitizeMunicipalityName(founder.name),
                sanitizeMunicipalityName(extractedMunicipalityName),
                founder.ico,
                String(founder.originalType),
                cityCode,
                cityDistrictCode,
            ], "founder", [
                "name",
                "short_name",
                "ico",
                "founder_type_code",
                "city_code",
                "city_district_code",
            ]);
            insertedFounders++;
        }
        founder.schools.forEach((school) => {
            schoolFounderConnectionData.push([school.izo, founderId]);
        });
    }
    const insertedConnections = yield insertMultipleRows(schoolFounderConnectionData, "school_founder", ["school_izo", "founder_id"], true);
    return insertedFounders + insertedConnections;
});
const getCityOfSchool = (izo) => __awaiter(void 0, void 0, void 0, function* () {
    return yield getKnexDb()
        .select("c.name", "c.code")
        .from("school as s")
        .join("school_location as l", "s.izo", "l.school_izo")
        .join("address_point as a", "l.address_point_id", "a.id")
        .join("city as c", "a.city_code", "c.code")
        .where("s.izo", izo)
        .limit(1)
        .first();
});
const getDistrictOfSchool = (izo) => __awaiter(void 0, void 0, void 0, function* () {
    return yield getKnexDb()
        .select("d.name", "d.code")
        .from("school as s")
        .join("school_location as l", "s.izo", "l.school_izo")
        .join("address_point as a", "l.address_point_id", "a.id")
        .join("city_district as d", "a.city_district_code", "d.code")
        .where("s.izo", izo)
        .limit(1)
        .first();
});
const fixFounderProblems = (founder, municipalityCode, differingSchools, extractedMunicipalityName) => __awaiter(void 0, void 0, void 0, function* () {
    if (differingSchools.length === 0 ||
        differingSchools.length < founder.schools.length) {
        return municipalityCode;
    }
    // either the school does not have a position (invalid RUIAN or missing building)
    // or the school is not in the same municipality as the founder
    // find all cities and their position with the same name as municipalityName
    const municipalities = yield findMunicipalitiesAndPositionsByNameAndType(extractedMunicipalityName, founder.municipalityType);
    // get one school position (if there are more schools, they should be close to each other)
    const schoolPosition = yield getKnexDb()
        .select("address_point.wgs84_latitude", "address_point.wgs84_longitude")
        .from("school")
        .join("school_location", "school.izo", "school_location.school_izo")
        .join("address_point", "school_location.address_point_id", "address_point.id")
        .whereIn("school.izo", differingSchools.map((school) => school.izo))
        .limit(1)
        .first();
    if (schoolPosition) {
        if (municipalities.length === 0) {
            if (municipalityCode === -1) {
                console.log(`no municipality by name or by location found for ${founder.name}`);
                return null;
            }
            else {
                console.log("no municipality matching the extracted name, using the municipality from RUIAN code");
            }
        }
        else if (municipalities.length === 1) {
            console.log("using the only municipality found matching the extracted name");
            return municipalities[0].code;
        }
        else {
            console.log("using the closest municipality matching the extracted name");
            return getClosestCode({
                code: 1,
                lat: schoolPosition.wgs84_latitude,
                lng: schoolPosition.wgs84_longitude,
            }, municipalities.map((municipality) => ({
                code: municipality.code,
                lat: municipality.lat,
                lng: municipality.lng,
            })));
        }
    }
    else {
        if (municipalities.length > 0) {
            if (municipalities.length > 1) {
                console.log(`using the first municipality matching the extracted name (${municipalities.length} matches) - possibly incorrect!`);
            }
            else {
                console.log("using the only municipality found matching the extracted name");
            }
            return municipalities[0].code;
        }
        else {
            console.log(`no municipality by name or by location found for ${founder.name}`);
            return null;
        }
    }
});
const getClosestCode = (from, toList) => __awaiter(void 0, void 0, void 0, function* () {
    let lowestDistance = Number.MAX_SAFE_INTEGER;
    let code = null;
    for (const place of toList) {
        let municipalityDistance = distance([place.lat, place.lng], [from.lat, from.lng]);
        if (municipalityDistance < lowestDistance) {
            lowestDistance = municipalityDistance;
            code = place.code;
        }
    }
    return code;
});
const getCityCodeByDistrictCode = (districtCode) => __awaiter(void 0, void 0, void 0, function* () {
    var _d;
    const result = yield getKnexDb()
        .first("city.code")
        .from("city_district")
        .join("city", "city_district.city_code", "city.code")
        .where("city_district.code", districtCode)
        .limit(1);
    return (_d = result === null || result === void 0 ? void 0 : result.code) !== null && _d !== void 0 ? _d : null;
});
const findMunicipalitiesAndPositionsByNameAndType = (name, type) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb();
    return (type === MunicipalityType.City
        ? yield knex
            .select("city.name", "city.code", "address_point.wgs84_latitude", "address_point.wgs84_longitude")
            .from("city")
            .join("address_point", "city.code", "address_point.city_code")
            .where("city.name", name)
            .groupBy("city.code")
        : yield knex
            .select("city_district.name", "city_district.code", "address_point.wgs84_latitude", "address_point.wgs84_longitude")
            .from("city_district")
            .join("address_point", "city_district.code", "address_point.city_district_code")
            .where("city_district.name", name)
            .groupBy("city_district.code")).map((row) => ({
        code: row.code,
        type,
        lat: row.wgs84_latitude,
        lng: row.wgs84_longitude,
    }));
});
const extractFounderName = (line) => {
    if (line[0] === "#") {
        return line.substring(1).trim();
    }
    else {
        return line.trim();
    }
};
export const findFounder = (nameWithHashtag) => __awaiter(void 0, void 0, void 0, function* () {
    const errors = [];
    const name = extractFounderName(nameWithHashtag);
    const result = yield getKnexDb()
        .select("f.id", "f.name", "f.ico", "f.founder_type_code", "f.city_code", "f.city_district_code")
        .from("founder as f")
        .leftJoin("city as c", "c.code", "f.city_code")
        .leftJoin("city_district as d", "d.code", "f.city_district_code")
        .where("f.name", name)
        .orWhere("c.name", name)
        .orWhere("d.name", name)
        .first();
    if (result) {
        return { founder: yield resultToFounder(result), errors };
    }
    else {
        const allFounderNames = yield getAllFounderNames();
        const namesList = allFounderNames
            .map((row) => row.founderName)
            .concat(allFounderNames.map((row) => row.municipalityName));
        const bestMatch = findClosestString(name, namesList);
        const bestMatchRow = allFounderNames.find((foundersNames) => foundersNames.founderName === bestMatch ||
            foundersNames.municipalityName === bestMatch);
        if (!bestMatchRow) {
            errors.push(wholeLineError(`Nenašli jsme žádné zřizovatele, nejspíš jste zapomněli inicializovat databázi.`, nameWithHashtag));
            return {
                founder: null,
                errors,
            };
        }
        errors.push(wholeLineError(`Zřizovatel '${name}' neexistuje, mysleli jste '${bestMatch}'?`, nameWithHashtag));
        const founder = yield getKnexDb()
            .select("id", "name", "ico", "founder_type_code", "city_code", "city_district_code")
            .from("founder")
            .where("id", bestMatchRow.id)
            .first();
        return {
            founder: yield resultToFounder(founder),
            errors,
        };
    }
});
let cachedCityCode = null;
let cityCodeFounder = null;
export const getFounderCityCode = (founder) => __awaiter(void 0, void 0, void 0, function* () {
    if (founder.municipalityType === MunicipalityType.District) {
        if (cityCodeFounder !== founder) {
            cityCodeFounder = founder;
            cachedCityCode = yield getKnexDb()
                .pluck("city_code")
                .from("city_district")
                .where("code", founder.cityOrDistrictCode)
                .first();
        }
        return cachedCityCode;
    }
    else {
        return founder.cityOrDistrictCode;
    }
});
const resultToFounder = (result) => __awaiter(void 0, void 0, void 0, function* () {
    return {
        name: result.name,
        ico: result.ico,
        originalType: result.founder_type_code,
        municipalityType: result.founder_type_code === cityTypeCode
            ? MunicipalityType.City
            : MunicipalityType.District,
        cityOrDistrictCode: result.founder_type_code === cityTypeCode
            ? result.city_code
            : result.city_district_code,
        schools: yield getSchoolsByFounderId(parseInt(result.id)),
    };
});
const getSchoolsByFounderId = (founderId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield getKnexDb()
        .select("s.izo", "s.redizo", "s.name", "s.capacity", "sl.address_point_id")
        .from("school as s")
        .join("school_founder as sf", "s.izo", "sf.school_izo")
        .join("school_location as sl", "s.izo", "sl.school_izo")
        .where("sf.founder_id", founderId);
    return result.map((row) => ({
        izo: String(row.izo),
        redizo: String(row.redizo),
        name: String(row.name),
        capacity: parseInt(row.capacity),
        locations: [
            {
                addressPointId: parseInt(row.address_point_id),
            },
        ],
    }));
});
const getAllFounderNames = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield getKnexDb()
        .select("f.id", "f.name as founder_name", "c.name as city_name", "d.name as city_district_name")
        .from("founder as f")
        .leftJoin("city as c", "c.code", "f.city_code")
        .leftJoin("city_district as d", "d.code", "f.city_district_code");
    return result.map((row) => ({
        id: parseInt(row.id),
        founderName: String(row.founder_name),
        municipalityName: String(row.city_name ? row.city_name : row.city_district_name),
    }));
});
export const findMunicipalityPartByName = (name, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const errors = [];
    const cityCode = yield getFounderCityCode(founder);
    const result = yield getKnexDb()
        .first("code")
        .from("municipality_part")
        .where({ name, city_code: cityCode });
    if (result) {
        return { municipalityPartCode: result.code, errors };
    }
    else {
        const allNames = yield getAllMunicipalityPartNames(cityCode);
        const namesList = allNames.map((row) => row.name);
        const bestMatch = findClosestString(name, namesList);
        errors.push({
            message: `Obec ani městská část '${name}' neexistuje, mysleli jste '${bestMatch}'?`,
            startOffset: 0,
            endOffset: 0,
        });
        return {
            municipalityPartCode: null,
            errors,
        };
    }
});
export const findMunicipalityByNameAndType = (name, type, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const errors = [];
    const result = type === MunicipalityType.City
        ? yield getKnexDb().select("code").from("city").where("name", name)
        : yield getKnexDb()
            .select("code")
            .from("city_district")
            .where("name", name)
            .andWhere("city_code", yield getFounderCityCode(founder));
    if (result.length > 0) {
        if (result.length > 1) {
            const cityCode = yield getFounderCityCode(founder);
            const positions = yield getKnexDb()
                .select("city_code", "wgs84_latitude", "wgs84_longitude")
                .from("address_point")
                .groupBy("city_code")
                .whereIn("city_code", result.map((row) => row.code));
            const founderPosition = yield getKnexDb()
                .first("wgs84_latitude", "wgs84_longitude")
                .from("address_point")
                .groupBy("city_code")
                .where("city_code", cityCode);
            const closestCode = yield getClosestCode({
                code: cityCode,
                lat: founderPosition.wgs84_latitude,
                lng: founderPosition.wgs84_longitude,
            }, positions.map((row) => ({
                code: row.city_code,
                lat: row.wgs84_latitude,
                lng: row.wgs84_longitude,
            })));
            return { municipality: { code: closestCode, type }, errors };
        }
        else {
            return { municipality: { code: result[0].code, type }, errors };
        }
    }
    else {
        const allNames = yield getAllMunicipalityNames(type);
        const namesList = allNames.map((row) => row.name);
        const bestMatch = findClosestString(name, namesList);
        const bestMatchRow = allNames.find((municipality) => municipality.name === bestMatch);
        errors.push({
            message: `Obec ani městská část '${name}' neexistuje, mysleli jste '${bestMatch}'?`,
            startOffset: 0,
            endOffset: 0,
        });
        return {
            municipality: { code: bestMatchRow.code, type },
            errors,
        };
    }
});
const getAllMunicipalityNames = (type) => __awaiter(void 0, void 0, void 0, function* () {
    return (yield getKnexDb()
        .select("name", "code")
        .from(type === MunicipalityType.City ? "city" : "city_district")).map((row) => ({
        name: row.name,
        code: row.code,
    }));
});
const getAllMunicipalityPartNames = (cityCode) => __awaiter(void 0, void 0, void 0, function* () {
    return (yield getKnexDb()
        .select("name", "code")
        .from("municipality_part")
        .where("city_code", cityCode)).map((row) => ({
        name: row.name,
        code: row.code,
    }));
});
