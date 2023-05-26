import { MunicipalityType } from "./types";
import { getDb, insertAutoincrementRow, insertMultipleRows } from "./db";
import { extractMunicipalityName, findClosestString } from "../utils/helpers";
const cityTypeCode = 261;
const cityDistrictTypeCode = 263;
export const insertFounders = (founders) => {
    const db = getDb();
    const selectCityStatement = db.prepare(`SELECT c.name, c.code FROM school s
    JOIN school_location l ON s.izo = l.school_izo
    JOIN address_point a ON l.address_point_id = a.id
    JOIN city c ON a.city_code = c.code
    WHERE s.izo = ?
    LIMIT 1`);
    const selectDistrictStatement = db.prepare(`SELECT d.name, d.code FROM school s
    JOIN school_location l ON s.izo = l.school_izo
    JOIN address_point a ON l.address_point_id = a.id
    JOIN city_district d ON a.city_district_code = d.code
    WHERE s.izo = ?
    LIMIT 1`);
    let insertedFounders = 0;
    const schoolFounderConnectionData = [];
    founders.forEach((founder) => {
        if (founder.municipalityType !== MunicipalityType.City &&
            founder.municipalityType !== MunicipalityType.District) {
            return;
        }
        const municipalityName = extractMunicipalityName(founder);
        // check if the extracted municipality name is the same as in all the schools' locations
        let allEqual = true;
        let municipalityCode = "";
        founder.schools.forEach((school) => {
            const result = (founder.municipalityType === MunicipalityType.City
                ? selectCityStatement
                : selectDistrictStatement).get(school.izo);
            if (!result) {
                console.log(`izo: ${school.izo}, extracted: ${municipalityName}, RUIAN: UNDEFINED`);
                allEqual = false;
            }
            else {
                const { name, code } = result;
                municipalityCode = code;
                if (name !== municipalityName) {
                    console.log(`izo: ${school.izo}, extracted: ${municipalityName}, RUIAN: ${name}`);
                    allEqual = false;
                }
            }
        });
        if (!allEqual) {
            // here we could try to find the correct municipality by searching for the name in the DB
            // this would solve the case of one school in the whole Czech Republic that is located outside
            // its founder municipality - too much work for now
            return;
        }
        const founderId = insertAutoincrementRow([
            founder.name,
            founder.ico,
            String(founder.originalType),
            founder.municipalityType === MunicipalityType.City
                ? municipalityCode
                : null,
            founder.municipalityType === MunicipalityType.City
                ? null
                : municipalityCode,
        ], "founder", ["name", "ico", "founder_type_code", "city_code", "city_district_code"]);
        if (founderId !== null) {
            insertedFounders++;
            founder.schools.forEach((school) => {
                schoolFounderConnectionData.push([school.izo, founderId]);
            });
        }
    });
    const insertedConnections = insertMultipleRows(schoolFounderConnectionData, "school_founder", ["school_izo", "founder_id"]);
    return insertedFounders + insertedConnections;
};
export const findFounder = (name) => {
    const errors = [];
    const db = getDb();
    const exactMatchStatement = db.prepare(`SELECT f.id, f.name, f.ico, f.founder_type_code, f.city_code, f.city_district_code FROM founder f
    LEFT JOIN city c ON c.code = f.city_code
    LEFT JOIN city_district d ON d.code = f.city_district_code
    WHERE f.name = ? OR c.name = ? OR d.name = ?`);
    const result = exactMatchStatement.get(name, name, name);
    if (result) {
        return { founder: resultToFounder(result), errors };
    }
    else {
        const allFounderNames = getAllFounderNames();
        const namesList = allFounderNames
            .map((row) => row.founderName)
            .concat(allFounderNames.map((row) => row.municipalityName));
        const bestMatch = findClosestString(name, namesList);
        const bestMatchRow = allFounderNames.find((foundersNames) => foundersNames.founderName === bestMatch ||
            foundersNames.municipalityName === bestMatch);
        errors.push(`No exact match for founder "${name}", using "${bestMatch}" instead.`);
        const findByIdStatement = db.prepare(`SELECT f.id, f.name, f.ico, f.founder_type_code, f.city_code, f.city_district_code FROM founder f
      WHERE f.id = ?`);
        return {
            founder: resultToFounder(findByIdStatement.get(bestMatchRow.id)),
            errors,
        };
    }
};
let cachedCityCode = null;
let cityCodeFounder = null;
export const getFounderCityCode = (founder) => {
    const db = getDb();
    if (founder.municipalityType === MunicipalityType.District) {
        if (cityCodeFounder !== founder) {
            const founderStatement = db.prepare(`
        SELECT city_code
        FROM city_district
        WHERE code = ?
      `);
            cachedCityCode = founderStatement.get(founder.cityOrDistrictCode).city_code;
        }
        return cachedCityCode;
    }
    else {
        return founder.cityOrDistrictCode;
    }
};
const resultToFounder = (result) => {
    return {
        name: result.name,
        ico: result.ico,
        originalType: result.founder_type_code,
        municipalityType: result.founder_type_code === cityTypeCode
            ? MunicipalityType.City
            : MunicipalityType.District,
        cityOrDistrictCode: result.city_code || result.city_district_code,
        schools: getSchoolsByFounderId(parseInt(result.id)),
    };
};
const getSchoolsByFounderId = (founderId) => {
    const db = getDb();
    const statement = db.prepare(`SELECT s.izo, s.name, s.capacity, sl.address_point_id FROM school s
    JOIN school_founder sf ON s.izo = sf.school_izo
    JOIN school_location sl ON s.izo = sl.school_izo
    WHERE sf.founder_id = ?`);
    return statement.all(founderId).map((row) => ({
        izo: String(row.izo),
        name: String(row.name),
        capacity: parseInt(row.capacity),
        locations: [
            {
                addressPointId: parseInt(row.address_point_id),
            },
        ],
    }));
};
const getAllFounderNames = () => {
    const db = getDb();
    const statement = db.prepare(`SELECT f.id, f.name AS founder_name, c.name AS city_name, d.name AS city_district_name FROM founder f
    LEFT JOIN city c ON c.code = f.city_code
    LEFT JOIN city_district d ON d.code = f.city_district_code`);
    const result = statement.all();
    return result.map((row) => ({
        id: parseInt(row.id),
        founderName: String(row.founder_name),
        municipalityName: String(row.city_name ? row.city_name : row.city_district_name),
    }));
};
export const findMunicipalityByNameAndType = (name, type) => {
    const errors = [];
    const db = getDb();
    const exactMatchStatement = db.prepare(`SELECT code FROM ${type === MunicipalityType.City ? "city" : "city_district"} WHERE name = ?`);
    const result = exactMatchStatement.get(name);
    if (result) {
        return { municipality: { code: result.code, type }, errors };
    }
    else {
        const allNames = getAllMunicipalityNames(type);
        const namesList = allNames.map((row) => row.name);
        const bestMatch = findClosestString(name, namesList);
        const bestMatchRow = allNames.find((municipality) => municipality.name === bestMatch);
        errors.push(`No exact match for municipality "${name}", using "${bestMatch}" instead.`);
        return {
            municipality: { code: bestMatchRow.code, type },
            errors,
        };
    }
};
const getAllMunicipalityNames = (type) => {
    const db = getDb();
    const statement = db.prepare(`SELECT name, code FROM ${type === MunicipalityType.City ? "city" : "city_district"}`);
    const result = statement.all();
    return result.map((row) => ({
        name: row.name,
        code: row.code,
    }));
};
