import {
  Founder,
  Municipality,
  MunicipalityType,
  MunicipalityWithPosition,
  Position,
  School,
} from "./types";
import {
  generatePlaceholders,
  getDb,
  insertAutoincrementRow,
  insertMultipleRows,
} from "./db";
import { extractMunicipalityName, findClosestString } from "../utils/helpers";
import { DbMunicipalityResult } from "../street-markdown/types";
import distance from "@turf/distance";

const cityTypeCode = 261;
const cityDistrictTypeCode = 263;

export const insertFounders = (founders: Founder[]): number => {
  const db = getDb();
  const selectCityStatement = db.prepare(
    `SELECT c.name, c.code FROM school s
    JOIN school_location l ON s.izo = l.school_izo
    JOIN address_point a ON l.address_point_id = a.id
    JOIN city c ON a.city_code = c.code
    WHERE s.izo = ?
    LIMIT 1`
  );

  const selectDistrictStatement = db.prepare(
    `SELECT d.name, d.code FROM school s
    JOIN school_location l ON s.izo = l.school_izo
    JOIN address_point a ON l.address_point_id = a.id
    JOIN city_district d ON a.city_district_code = d.code
    WHERE s.izo = ?
    LIMIT 1`
  );

  let insertedFounders = 0;
  const schoolFounderConnectionData = [];

  founders.forEach((founder) => {
    if (
      founder.municipalityType !== MunicipalityType.City &&
      founder.municipalityType !== MunicipalityType.District
    ) {
      return;
    }
    const extractedMunicipalityName = extractMunicipalityName(founder);

    // check if the extracted municipality name is the same as in all the schools' locations
    let differingSchools = [];
    let municipalityCode = -1;
    let municipalityName = extractedMunicipalityName;
    founder.schools.forEach((school) => {
      const result = (
        founder.municipalityType === MunicipalityType.City
          ? selectCityStatement
          : selectDistrictStatement
      ).get(school.izo);
      if (!result) {
        console.log(
          `izo: ${school.izo}, extracted: ${extractedMunicipalityName}, RUIAN: UNDEFINED`
        );
        differingSchools.push(school);
      } else {
        const { name, code } = result;
        if (name !== extractedMunicipalityName) {
          console.log(
            `izo: ${school.izo}, extracted: ${extractedMunicipalityName}, RUIAN: ${name}`
          );
          differingSchools.push(school);
        }
        // store municipalityCode even if the names don't match, we will use it later
        municipalityCode = parseInt(code);
        municipalityName = name;
      }
    });

    if (
      differingSchools.length > 0 &&
      differingSchools.length === founder.schools.length
    ) {
      // find all cities and their position with the same name as municipalityName
      const municipalities = findMunicipalitiesAndPositionsByNameAndType(
        extractedMunicipalityName,
        founder.municipalityType
      );

      // get one school position (if there are more schools, they should be close to each other)
      const schoolPosition:
        | { wgs84_latitude: number; wgs84_longitude: number }
        | undefined = db
        .prepare(
          `SELECT a.wgs84_latitude, a.wgs84_longitude FROM school s
          JOIN school_location l ON s.izo = l.school_izo
          JOIN address_point a ON l.address_point_id = a.id
          WHERE s.izo IN (${generatePlaceholders(differingSchools.length)})
          LIMIT 1`
        )
        .get(...differingSchools.map((school) => school.izo));

      if (schoolPosition) {
        municipalityName = extractedMunicipalityName;
        if (municipalities.length === 0) {
          if (municipalityCode === -1) {
            console.log(
              `no municipality by name or by location found for ${founder.name}`
            );
            return;
          } else {
            console.log("no municipality matching the extracted name, using the municipality from RUIAN code");
          }
        } else if (municipalities.length === 1) {
          municipalityCode = municipalities[0].code;
          console.log("using the only municipality found matching the extracted name");
        } else {
          // get code and position of the closest city
          let lowestDistance = Number.MAX_SAFE_INTEGER;
          for (const municipality of municipalities) {
            let municipalityDistance = distance(
              [municipality.lat, municipality.lng],
              [schoolPosition.wgs84_latitude, schoolPosition.wgs84_longitude]
            );
            if (municipalityDistance < lowestDistance) {
              lowestDistance = municipalityDistance;
              municipalityCode = municipality.code;
            }
          }
          console.log("using the closest municipality matching the extracted name");
        }
      } else {
        if (municipalities.length > 0) {
          municipalityCode = municipalities[0].code;
          if (municipalities.length > 1) {
            console.log(`using the first municipality matching the extracted name (${municipalities.length} matches) - possibly incorrect!`);
          } else {
            console.log("using the only municipality found matching the extracted name");
          }
        } else {
          console.log(
            `no municipality by name or by location found for ${founder.name}`
          );
          return;
        }
      }
    }

    const founderId = insertAutoincrementRow(
      [
        founder.name,
        founder.ico,
        String(founder.originalType),
        founder.municipalityType === MunicipalityType.City
          ? municipalityCode.toString()
          : null,
        founder.municipalityType === MunicipalityType.City
          ? null
          : municipalityCode.toString(),
      ],
      "founder",
      ["name", "ico", "founder_type_code", "city_code", "city_district_code"]
    );
    if (founderId !== null) {
      insertedFounders++;
      founder.schools.forEach((school) => {
        schoolFounderConnectionData.push([school.izo, founderId]);
      });
    }
  });

  const insertedConnections = insertMultipleRows(
    schoolFounderConnectionData,
    "school_founder",
    ["school_izo", "founder_id"]
  );

  return insertedFounders + insertedConnections;
};

const findMunicipalitiesAndPositionsByNameAndType = (
  name: string,
  type: MunicipalityType
): MunicipalityWithPosition[] => {
  const db = getDb();
  return (
    type === MunicipalityType.City
      ? db
          .prepare(
            `SELECT c.name, c.code, a.wgs84_latitude, a.wgs84_longitude FROM city c
            JOIN address_point a ON c.code = a.city_code
            WHERE c.name = ?
            GROUP BY c.code`
          )
          .all(name)
      : db
          .prepare(
            `SELECT d.name, d.code, a.wgs84_latitude, a.wgs84_longitude FROM city_district d
            JOIN address_point a ON d.code = a.city_district_code
            WHERE d.name = ?
            GROUP BY d.code`
          )
          .all(name)
  ).map((row) => ({
    code: row.code,
    type,
    lat: row.wgs84_latitude,
    lng: row.wgs84_longitude,
  }));
};

export const findFounder = (
  name: string
): { founder: Founder; errors: string[] } => {
  const errors = [];
  const db = getDb();
  const exactMatchStatement = db.prepare(
    `SELECT f.id, f.name, f.ico, f.founder_type_code, f.city_code, f.city_district_code FROM founder f
    LEFT JOIN city c ON c.code = f.city_code
    LEFT JOIN city_district d ON d.code = f.city_district_code
    WHERE f.name = ? OR c.name = ? OR d.name = ?`
  );
  const result = exactMatchStatement.get(name, name, name);
  if (result) {
    return { founder: resultToFounder(result), errors };
  } else {
    const allFounderNames = getAllFounderNames();
    const namesList = allFounderNames
      .map((row) => row.founderName)
      .concat(allFounderNames.map((row) => row.municipalityName));
    const bestMatch = findClosestString(name, namesList);
    const bestMatchRow = allFounderNames.find(
      (foundersNames) =>
        foundersNames.founderName === bestMatch ||
        foundersNames.municipalityName === bestMatch
    );

    errors.push(
      `No exact match for founder "${name}", using "${bestMatch}" instead.`
    );

    const findByIdStatement = db.prepare(
      `SELECT f.id, f.name, f.ico, f.founder_type_code, f.city_code, f.city_district_code FROM founder f
      WHERE f.id = ?`
    );
    return {
      founder: resultToFounder(findByIdStatement.get(bestMatchRow.id)),
      errors,
    };
  }
};

let cachedCityCode: number = null;
let cityCodeFounder: Founder = null;
export const getFounderCityCode = (founder: Founder): number => {
  const db = getDb();
  if (founder.municipalityType === MunicipalityType.District) {
    if (cityCodeFounder !== founder) {
      const founderStatement = db.prepare(`
        SELECT city_code
        FROM city_district
        WHERE code = ?
      `);
      cachedCityCode = founderStatement.get(
        founder.cityOrDistrictCode
      ).city_code;
    }
    return cachedCityCode;
  } else {
    return founder.cityOrDistrictCode;
  }
};

interface FounderNames {
  id: number;
  founderName: string;
  municipalityName: string;
}

const resultToFounder = (result: any): Founder => {
  return {
    name: result.name,
    ico: result.ico,
    originalType: result.founder_type_code,
    municipalityType:
      result.founder_type_code === cityTypeCode
        ? MunicipalityType.City
        : MunicipalityType.District,
    cityOrDistrictCode: result.city_code || result.city_district_code,
    schools: getSchoolsByFounderId(parseInt(result.id)),
  };
};

const getSchoolsByFounderId = (founderId: number): School[] => {
  const db = getDb();
  const statement = db.prepare(
    `SELECT s.izo, s.name, s.capacity, sl.address_point_id FROM school s
    JOIN school_founder sf ON s.izo = sf.school_izo
    JOIN school_location sl ON s.izo = sl.school_izo
    WHERE sf.founder_id = ?`
  );

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

const getAllFounderNames = (): FounderNames[] => {
  const db = getDb();
  const statement = db.prepare(
    `SELECT f.id, f.name AS founder_name, c.name AS city_name, d.name AS city_district_name FROM founder f
    LEFT JOIN city c ON c.code = f.city_code
    LEFT JOIN city_district d ON d.code = f.city_district_code`
  );
  const result = statement.all();
  return result.map((row) => ({
    id: parseInt(row.id),
    founderName: String(row.founder_name),
    municipalityName: String(
      row.city_name ? row.city_name : row.city_district_name
    ),
  }));
};

export const findMunicipalityByNameAndType = (
  name: string,
  type: MunicipalityType
): DbMunicipalityResult => {
  const errors = [];
  const db = getDb();

  const exactMatchStatement = db.prepare(
    `SELECT code FROM ${
      type === MunicipalityType.City ? "city" : "city_district"
    } WHERE name = ?`
  );
  const result = exactMatchStatement.get(name);
  if (result) {
    return { municipality: { code: result.code, type }, errors };
  } else {
    const allNames = getAllMunicipalityNames(type);
    const namesList = allNames.map((row) => row.name);
    const bestMatch = findClosestString(name, namesList);
    const bestMatchRow = allNames.find(
      (municipality) => municipality.name === bestMatch
    );

    errors.push(
      `No exact match for municipality "${name}", using "${bestMatch}" instead.`
    );

    return {
      municipality: { code: bestMatchRow.code, type },
      errors,
    };
  }
};

const getAllMunicipalityNames = (
  type: MunicipalityType
): { name: string; code: number }[] => {
  const db = getDb();
  const statement = db.prepare(
    `SELECT name, code FROM ${
      type === MunicipalityType.City ? "city" : "city_district"
    }`
  );
  const result = statement.all();
  return result.map((row) => ({
    name: row.name,
    code: row.code,
  }));
};
