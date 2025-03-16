import { wholeLineError } from "../street-markdown/smd";
import { SmdError } from "../street-markdown/types";
import { findClosestString } from "../utils/helpers";
import { getKnexDb, insertMultipleRows } from "./db";
import { School } from "./types";

export const insertSchools = async (schools: School[]): Promise<number> => {
  const knex = getKnexDb();

  const uniqueSchools = filterOutDuplicates(schools);
  const existingIzo = (await knex.select("izo").from("school")).map(
    (row) => row.izo
  );

  const toInsert = uniqueSchools.filter(
    (school) => !existingIzo.includes(school.izo)
  );
  const toUpdate = uniqueSchools.filter((school) =>
    existingIzo.includes(school.izo)
  );

  for (const school of toUpdate) {
    await knex.from("school").where("izo", school.izo).update({
      name: school.name,
      capacity: school.capacity,
    });
  }

  const insertedSchools = await insertMultipleRows(
    toInsert.map((school) => [
      school.izo,
      school.redizo,
      school.name,
      school.capacity.toString(),
      school.type.toString(),
    ]),
    "school",
    ["izo", "redizo", "name", "capacity", "type"]
  );

  const locations = toInsert
    .filter((school) => school.locations.length > 0)
    .map((school) => [
      school.izo,
      school.locations[0].addressPointId.toString(), // add only first location
    ]);

  let insertedLocations = 0;

  // plus filter out duplicate locations (same address id + izo)
  for (const location of locations) {
    try {
      insertedLocations += await insertMultipleRows(
        [location],
        "school_location",
        ["school_izo", "address_point_id"],
        true
      );
    } catch (error) {
      console.log(
        `Cannot add location with RUIAN code ${location[1]} (school IZO = ${location[0]}): code does not exist.`
      );
    }
  }

  return insertedSchools + insertedLocations;
};

export const findSchool = (
  name: string,
  schools: School[],
  maxDistance?: number
): { school: School | null; errors: SmdError[] } => {
  if (schools.length === 0) {
    return {
      school: null,
      errors: [wholeLineError("Aktuální zřizovatel nemá žádné školy.", name)],
    };
  }

  const errors: SmdError[] = [];

  const exactSchool = schools.find((school) => school.name === name);
  if (exactSchool) {
    return { school: exactSchool, errors };
  }

  const namesList = schools.map((school) => school.name);
  const bestMatch = findClosestString(name, namesList, maxDistance);
  if (bestMatch === null) {
    errors.push(wholeLineError(`Škola s názvem '${name}' neexistuje.`, name));
    return { school: null, errors };
  }
  const closestSchool = schools.find((school) => bestMatch === school.name);

  errors.push(
    wholeLineError(
      `Škola s názvem '${name}' neexistuje, mysleli jste '${bestMatch}'?`,
      name
    )
  );

  return { school: closestSchool, errors };
};

const filterOutDuplicates = (schools: School[]): School[] => {
  const izoSet = new Set();
  return schools.filter((school) => {
    const duplicate = izoSet.has(school.izo);
    izoSet.add(school.izo);
    return !duplicate;
  });
};
