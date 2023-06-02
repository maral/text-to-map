import { findClosestString } from "../utils/helpers";
import { getDb, insertMultipleRows } from "./db";
export const insertSchools = (schools) => {
    const db = getDb();
    const uniqueSchools = filterOutDuplicates(schools);
    const existingIzo = db.prepare("SELECT izo FROM school").pluck().all();
    const toInsert = uniqueSchools.filter((school) => !existingIzo.includes(school.izo));
    const toUpdate = uniqueSchools.filter((school) => existingIzo.includes(school.izo));
    toUpdate.forEach((school) => {
        db.prepare("UPDATE school SET name = ?, capacity = ? WHERE izo = ?").run(school.name, school.capacity, school.izo);
    });
    const insertedSchools = insertMultipleRows(toInsert.map((school) => [
        school.izo,
        school.redizo,
        school.name,
        school.capacity.toString(),
    ]), "school", ["izo", "redizo", "name", "capacity"]);
    const locations = toInsert
        .filter((school) => school.locations.length > 0)
        .map((school) => [
        school.izo,
        school.locations[0].addressPointId.toString(), // add only first location
    ]);
    let insertedLocations = 0;
    // plus filter out duplicate locations (same address id + izo)
    locations.forEach((location) => {
        try {
            insertedLocations += insertMultipleRows([location], "school_location", ["school_izo", "address_point_id"], false);
        }
        catch (error) {
            console.log(`Cannot add location with RUIAN code ${location[1]} (school IZO = ${location[0]}): code does not exist.`);
        }
    });
    return insertedSchools + insertedLocations;
};
export const findSchool = (name, schools) => {
    if (schools.length === 0) {
        return { school: null, errors: ["No schools for this founder."] };
    }
    let school = null;
    const errors = [];
    school = schools.find((school) => school.name === name);
    if (school) {
        return { school, errors };
    }
    const namesList = schools.map((school) => school.name);
    const bestMatch = findClosestString(name, namesList);
    school = schools.find((school) => bestMatch === school.name);
    errors.push(`No exact match for school "${name}", using "${bestMatch}" instead.`);
    return { school, errors };
};
const filterOutDuplicates = (schools) => {
    const izoSet = new Set();
    return schools.filter((school) => {
        const duplicate = izoSet.has(school.izo);
        izoSet.add(school.izo);
        return !duplicate;
    });
};
