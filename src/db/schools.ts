import { wholeLineError } from "../street-markdown/smd";
import { SmdError } from "../street-markdown/types";
import { findClosestString } from "../utils/helpers";
import { getKnexDb, insertMultipleRows } from "./db";
import { School } from "./types";

const BATCH_SIZE = 500;

export const insertSchools = async (schools: School[]): Promise<number> => {
  const knex = getKnexDb();

  const uniqueSchools = filterOutDuplicates(schools);

  // Fetch all existing schools with their current location in one query
  const existing: { izo: string; name: string; capacity: number; address_point_id: number | null }[] =
    await knex("school")
      .leftJoin("school_location", "school.izo", "school_location.school_izo")
      .select("school.izo", "school.name", "school.capacity", "school_location.address_point_id");

  const existingMap = new Map(existing.map((r) => [r.izo, r]));

  const toInsert = uniqueSchools.filter((s) => !existingMap.has(s.izo));
  const toUpdate = uniqueSchools.filter((s) => existingMap.has(s.izo));

  // --- Insert new schools ---
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

  // --- Update existing schools (name + capacity) in batches ---
  const toUpdateFields = toUpdate.filter((s) => {
    const row = existingMap.get(s.izo);
    return row.name !== s.name || Number(row.capacity) !== s.capacity;
  });

  for (let i = 0; i < toUpdateFields.length; i += BATCH_SIZE) {
    const batch = toUpdateFields.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((s) =>
        knex("school").where("izo", s.izo).update({ name: s.name, capacity: s.capacity })
      )
    );
  }

  // --- Handle locations ---
  // New schools and existing schools without any location need an insert
  const toInsertLocation = [
    ...toInsert,
    ...toUpdate.filter((s) => existingMap.get(s.izo).address_point_id === null),
  ].filter((s) => s.locations.length > 0);

  // Existing schools whose first location changed need a delete + insert
  // Guard against reordering: only update if the old RUIAN is gone entirely from the new locations
  const toUpdateLocation = toUpdate.filter((s) => {
    const row = existingMap.get(s.izo);
    const newRuians = s.locations.map((l) => l.addressPointId);
    return (
      row.address_point_id !== null &&
      newRuians.length > 0 &&
      !newRuians.includes(row.address_point_id)
    );
  });

  // Delete outdated locations in batches
  for (let i = 0; i < toUpdateLocation.length; i += BATCH_SIZE) {
    const batch = toUpdateLocation.slice(i, i + BATCH_SIZE);
    await knex("school_location")
      .whereIn(
        "school_izo",
        batch.map((s) => s.izo)
      )
      .delete();
  }

  let insertedLocations = 0;

  for (const school of [...toInsertLocation, ...toUpdateLocation]) {
    try {
      insertedLocations += await insertMultipleRows(
        [[school.izo, school.locations[0].addressPointId.toString()]],
        "school_location",
        ["school_izo", "address_point_id"],
        true
      );
    } catch (error) {
      console.log(
        `Cannot add location with RUIAN code ${school.locations[0].addressPointId} (school IZO = ${school.izo}): code does not exist.`
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
