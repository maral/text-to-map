import distance from "@turf/distance";
import { wholeLineError } from "../street-markdown/smd";
import {
  DbMunicipalityResult,
  MunicipalityPartResult,
  SmdError,
} from "../street-markdown/types";
import {
  extractMunicipalityName,
  findClosestString,
  sanitizeMunicipalityName,
} from "../utils/helpers";
import { getKnexDb, insertAutoincrementRow, insertMultipleRows } from "./db";
import {
  Founder,
  MunicipalityType,
  MunicipalityWithPosition,
  PlaceWithPosition,
  School,
} from "./types";

const cityTypeCode = 261;
const cityDistrictTypeCode = 263;

export const insertFounders = async (founders: Founder[]): Promise<number> => {
  let insertedFounders = 0;
  const schoolFounderConnectionData = [];

  for (const founder of founders) {
    if (
      founder.municipalityType !== MunicipalityType.City &&
      founder.municipalityType !== MunicipalityType.District
    ) {
      continue;
    }
    const extractedMunicipalityName = extractMunicipalityName(founder);

    // check if the extracted municipality name is the same as in all the schools' locations
    let differingSchools = [];
    let municipalityCode = -1;

    for (const school of founder.schools) {
      const result = await (founder.municipalityType === MunicipalityType.City
        ? getCityOfSchool(school.izo)
        : getDistrictOfSchool(school.izo));
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
      }
    }

    municipalityCode = await fixFounderProblems(
      founder,
      municipalityCode,
      differingSchools,
      extractedMunicipalityName
    );

    const cityDistrictCode =
      founder.municipalityType === MunicipalityType.District
        ? municipalityCode.toString()
        : null;
    let cityCode = null;
    if (founder.municipalityType === MunicipalityType.City) {
      cityCode = municipalityCode?.toString() ?? null;
    } else {
      cityCode = await getCityCodeByDistrictCode(municipalityCode);
    }

    const existing = await getKnexDb()
      .select("*")
      .from("founder")
      .where({
        name: sanitizeMunicipalityName(founder.name),
        ico: founder.ico,
      });

    let founderId = existing[0]?.id ?? null;

    if (existing.length === 0) {
      founderId = await insertAutoincrementRow(
        [
          sanitizeMunicipalityName(founder.name),
          sanitizeMunicipalityName(extractedMunicipalityName),
          founder.ico,
          String(founder.originalType),
          cityCode,
          cityDistrictCode,
        ],
        "founder",
        [
          "name",
          "short_name",
          "ico",
          "founder_type_code",
          "city_code",
          "city_district_code",
        ]
      );
      insertedFounders++;
    }

    founder.schools.forEach((school) => {
      schoolFounderConnectionData.push([school.izo, founderId]);
    });
  }

  const insertedConnections = await insertMultipleRows(
    schoolFounderConnectionData,
    "school_founder",
    ["school_izo", "founder_id"],
    true
  );

  return insertedFounders + insertedConnections;
};

const getCityOfSchool = async (izo: string): Promise<any> => {
  return await getKnexDb()
    .select("c.name", "c.code")
    .from("school as s")
    .join("school_location as l", "s.izo", "l.school_izo")
    .join("address_point as a", "l.address_point_id", "a.id")
    .join("city as c", "a.city_code", "c.code")
    .where("s.izo", izo)
    .limit(1)
    .first();
};

const getDistrictOfSchool = async (izo: string): Promise<any> => {
  return await getKnexDb()
    .select("d.name", "d.code")
    .from("school as s")
    .join("school_location as l", "s.izo", "l.school_izo")
    .join("address_point as a", "l.address_point_id", "a.id")
    .join("city_district as d", "a.city_district_code", "d.code")
    .where("s.izo", izo)
    .limit(1)
    .first();
};

const fixFounderProblems = async (
  founder: Founder,
  municipalityCode: number,
  differingSchools: School[],
  extractedMunicipalityName: string
): Promise<number | null> => {
  if (
    differingSchools.length === 0 ||
    differingSchools.length < founder.schools.length
  ) {
    return municipalityCode;
  }

  // either the school does not have a position (invalid RUIAN or missing building)
  // or the school is not in the same municipality as the founder

  // find all cities and their position with the same name as municipalityName
  const municipalities = await findMunicipalitiesAndPositionsByNameAndType(
    extractedMunicipalityName,
    founder.municipalityType
  );

  // get one school position (if there are more schools, they should be close to each other)
  const schoolPosition:
    | { wgs84_latitude: number; wgs84_longitude: number }
    | undefined = await getKnexDb()
    .select("address_point.wgs84_latitude", "address_point.wgs84_longitude")
    .from("school")
    .join("school_location", "school.izo", "school_location.school_izo")
    .join(
      "address_point",
      "school_location.address_point_id",
      "address_point.id"
    )
    .whereIn(
      "school.izo",
      differingSchools.map((school) => school.izo)
    )
    .limit(1)
    .first();

  if (schoolPosition) {
    if (municipalities.length === 0) {
      if (municipalityCode === -1) {
        console.log(
          `no municipality by name or by location found for ${founder.name}`
        );
        return null;
      } else {
        console.log(
          "no municipality matching the extracted name, using the municipality from RUIAN code"
        );
      }
    } else if (municipalities.length === 1) {
      console.log(
        "using the only municipality found matching the extracted name"
      );
      return municipalities[0].code;
    } else {
      console.log("using the closest municipality matching the extracted name");
      return getClosestCode(
        {
          code: 1,
          lat: schoolPosition.wgs84_latitude,
          lng: schoolPosition.wgs84_longitude,
        },
        municipalities.map((municipality) => ({
          code: municipality.code,
          lat: municipality.lat,
          lng: municipality.lng,
        }))
      );
    }
  } else {
    if (municipalities.length > 0) {
      if (municipalities.length > 1) {
        console.log(
          `using the first municipality matching the extracted name (${municipalities.length} matches) - possibly incorrect!`
        );
      } else {
        console.log(
          "using the only municipality found matching the extracted name"
        );
      }
      return municipalities[0].code;
    } else {
      console.log(
        `no municipality by name or by location found for ${founder.name}`
      );
      return null;
    }
  }
};

const getClosestCode = async (
  from: PlaceWithPosition,
  toList: PlaceWithPosition[]
): Promise<number> => {
  let lowestDistance = Number.MAX_SAFE_INTEGER;
  let code: number = null;
  for (const place of toList) {
    let municipalityDistance = distance(
      [place.lat, place.lng],
      [from.lat, from.lng]
    );
    if (municipalityDistance < lowestDistance) {
      lowestDistance = municipalityDistance;
      code = place.code;
    }
  }
  return code;
};

const getCityCodeByDistrictCode = async (
  districtCode: number
): Promise<number | null> => {
  const result = await getKnexDb()
    .first("city.code")
    .from("city_district")
    .join("city", "city_district.city_code", "city.code")
    .where("city_district.code", districtCode)
    .limit(1);
  return result?.code ?? null;
};

const findMunicipalitiesAndPositionsByNameAndType = async (
  name: string,
  type: MunicipalityType
): Promise<MunicipalityWithPosition[]> => {
  const knex = getKnexDb();
  return (
    type === MunicipalityType.City
      ? await knex
          .select(
            "city.name",
            "city.code",
            "address_point.wgs84_latitude",
            "address_point.wgs84_longitude"
          )
          .from("city")
          .join("address_point", "city.code", "address_point.city_code")
          .where("city.name", name)
          .groupBy("city.code")
      : await knex
          .select(
            "city_district.name",
            "city_district.code",
            "address_point.wgs84_latitude",
            "address_point.wgs84_longitude"
          )
          .from("city_district")
          .join(
            "address_point",
            "city_district.code",
            "address_point.city_district_code"
          )
          .where("city_district.name", name)
          .groupBy("city_district.code")
  ).map((row) => ({
    code: row.code,
    type,
    lat: row.wgs84_latitude,
    lng: row.wgs84_longitude,
  }));
};

const extractFounderName = (line: string): string => {
  if (line[0] === "#") {
    return line.substring(1).trim();
  } else {
    return line.trim();
  }
};

const getBaseFounderQuery = () => {
  return getKnexDb()
    .select(
      "f.id",
      "f.name",
      "f.ico",
      "f.founder_type_code",
      "f.city_code",
      "f.city_district_code"
    )
    .from("founder as f")
    .leftJoin("city as c", "c.code", "f.city_code")
    .leftJoin("city_district as d", "d.code", "f.city_district_code")
    .orderBy("f.founder_type_code");
};

export const getFounderById = async (
  id: number
): Promise<{ founder: Founder; errors: SmdError[] }> => {
  const result = await getBaseFounderQuery().where("f.id", id).first();
  const founder = await resultToFounder(result);
  return {
    founder: founder ?? null,
    errors: founder
      ? []
      : [wholeLineError(`Zřizovatel s id ${id} neexistuje.`, "")],
  };
};

export const findFounder = async (
  nameWithHashtag: string
): Promise<{ founder: Founder; errors: SmdError[] }> => {
  const errors: SmdError[] = [];

  // special case where we search for a city instead of a founder
  if (nameWithHashtag[1] === "#") {
    const cityName = nameWithHashtag.substring(2).trim();
    const result = await getKnexDb()
      .select("code")
      .from("city")
      .where("name", cityName)
      .first();

    return {
      founder: {
        name: cityName,
        ico: "00000000",
        originalType: cityTypeCode,
        municipalityType: MunicipalityType.City,
        municipalityCode: result.code,
        schools: await getSchoolsByCityCode(result.code),
      },
      errors,
    };
  }

  const name = extractFounderName(nameWithHashtag);

  const result = await getBaseFounderQuery()
    .where("f.name", name)
    .orWhere("c.name", name)
    .orWhere("d.name", name)
    .first();
  if (result) {
    return { founder: await resultToFounder(result), errors };
  } else {
    const allFounderNames = await getAllFounderNames();
    const namesList = allFounderNames
      .map((row) => row.founderName)
      .concat(allFounderNames.map((row) => row.municipalityName));
    const bestMatch = findClosestString(name, namesList);
    const bestMatchRow = allFounderNames.find(
      (foundersNames) =>
        foundersNames.founderName === bestMatch ||
        foundersNames.municipalityName === bestMatch
    );

    if (!bestMatchRow) {
      errors.push(
        wholeLineError(
          `Nenašli jsme žádné zřizovatele, nejspíš jste zapomněli inicializovat databázi.`,
          nameWithHashtag
        )
      );
      return {
        founder: null,
        errors,
      };
    }

    errors.push(
      wholeLineError(
        `Zřizovatel '${name}' neexistuje, mysleli jste '${bestMatch}'?`,
        nameWithHashtag
      )
    );

    const founder = await getKnexDb()
      .select(
        "id",
        "name",
        "ico",
        "founder_type_code",
        "city_code",
        "city_district_code"
      )
      .from("founder")
      .where("id", bestMatchRow.id)
      .first();
    return {
      founder: await resultToFounder(founder),
      errors,
    };
  }
};

let cachedCityCode: number = null;
let cityCodeFounder: Founder = null;
export const getFounderCityCode = async (founder: Founder): Promise<number> => {
  if (founder.municipalityType === MunicipalityType.District) {
    if (cityCodeFounder !== founder) {
      cityCodeFounder = founder;
      cachedCityCode = (
        await getKnexDb()
          .from("city_district")
          .where("code", founder.municipalityCode)
          .first()
      ).city_code;
    }
    return cachedCityCode;
  } else {
    return founder.municipalityCode;
  }
};

interface FounderNames {
  id: number;
  founderName: string;
  municipalityName: string;
}

const resultToFounder = async (result: any): Promise<Founder> => {
  return {
    name: result.name,
    ico: result.ico,
    originalType: result.founder_type_code,
    municipalityType:
      result.founder_type_code === cityTypeCode
        ? MunicipalityType.City
        : MunicipalityType.District,
    municipalityCode:
      result.founder_type_code === cityTypeCode
        ? result.city_code
        : result.city_district_code,
    schools: await getSchoolsByCityCode(result.city_code),
  };
};

// in case of cities, load all schools in the city, not just the ones connected to the founder
const getSchoolsByCityCode = async (cityCode: number): Promise<School[]> => {
  const result = await getKnexDb()
    .select("s.izo", "s.redizo", "s.name", "s.capacity", "sl.address_point_id")
    .from("school as s")
    .join("school_founder as sf", "s.izo", "sf.school_izo")
    .join("school_location as sl", "s.izo", "sl.school_izo")
    .join("founder as f", "sf.founder_id", "f.id")
    .where("f.city_code", cityCode);

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
};

const getAllFounderNames = async (): Promise<FounderNames[]> => {
  const result = await getKnexDb()
    .select(
      "f.id",
      "f.name as founder_name",
      "c.name as city_name",
      "d.name as city_district_name"
    )
    .from("founder as f")
    .leftJoin("city as c", "c.code", "f.city_code")
    .leftJoin("city_district as d", "d.code", "f.city_district_code");
  return result.map((row) => ({
    id: parseInt(row.id),
    founderName: String(row.founder_name),
    municipalityName: String(
      row.city_name ? row.city_name : row.city_district_name
    ),
  }));
};

export const findMunicipalityPartByName = async (
  name: string,
  founder: Founder
): Promise<MunicipalityPartResult> => {
  const errors: SmdError[] = [];
  const cityCode = await getFounderCityCode(founder);
  const result = await getKnexDb()
    .first("code")
    .from("municipality_part")
    .where({ name, city_code: cityCode });

  if (result) {
    return { municipalityPartCode: result.code, errors };
  } else {
    const allNames = await getAllMunicipalityPartNames(cityCode);
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
};

export const findMunicipalityByNameAndType = async (
  name: string,
  type: MunicipalityType,
  founder: Founder
): Promise<DbMunicipalityResult> => {
  const errors: SmdError[] = [];

  const result =
    type === MunicipalityType.City
      ? await getKnexDb().select("code").from("city").where("name", name)
      : await getKnexDb()
          .select("code")
          .from("city_district")
          .where("name", name)
          .andWhere("city_code", await getFounderCityCode(founder));

  if (result.length > 0) {
    if (result.length > 1) {
      const cityCode = await getFounderCityCode(founder);
      const positions = await getKnexDb()
        .select("city_code", "wgs84_latitude", "wgs84_longitude")
        .from("address_point")
        .groupBy("city_code")
        .whereIn(
          "city_code",
          result.map((row) => row.code)
        );
      const founderPosition = await getKnexDb()
        .first("wgs84_latitude", "wgs84_longitude")
        .from("address_point")
        .groupBy("city_code")
        .where("city_code", cityCode);
      const closestCode = await getClosestCode(
        {
          code: cityCode,
          lat: founderPosition.wgs84_latitude,
          lng: founderPosition.wgs84_longitude,
        },
        positions.map((row) => ({
          code: row.city_code,
          lat: row.wgs84_latitude,
          lng: row.wgs84_longitude,
        }))
      );
      return { municipality: { code: closestCode, type }, errors };
    } else {
      return { municipality: { code: result[0].code, type }, errors };
    }
  } else {
    const allNames = await getAllMunicipalityNames(type);
    const namesList = allNames.map((row) => row.name);
    const bestMatch = findClosestString(name, namesList);
    const bestMatchRow = allNames.find(
      (municipality) => municipality.name === bestMatch
    );

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
};

const getAllMunicipalityNames = async (
  type: MunicipalityType
): Promise<{ name: string; code: number }[]> => {
  return (
    await getKnexDb()
      .select("name", "code")
      .from(type === MunicipalityType.City ? "city" : "city_district")
  ).map((row) => ({
    name: row.name,
    code: row.code,
  }));
};

const getAllMunicipalityPartNames = async (
  cityCode: number
): Promise<{ name: string; code: number }[]> => {
  return (
    await getKnexDb()
      .select("name", "code")
      .from("municipality_part")
      .where("city_code", cityCode)
  ).map((row) => ({
    name: row.name,
    code: row.code,
  }));
};
