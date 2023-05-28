import { getDb, insertMultipleRows } from "./db";
import { findClosestString } from "../utils/helpers";
export const insertSchools = (schools, doNotClearTable = false) => {
    if (!doNotClearTable) {
        const db = getDb();
        db.exec("DELETE FROM school_location");
        db.exec("DELETE FROM school_founder");
        db.exec("DELETE FROM school_location");
        db.exec("DELETE FROM founder");
        db.exec("DELETE FROM school");
        db.exec("DELETE FROM sqlite_sequence WHERE name='school_location' OR name='founder' OR name='school_founder'");
    }
    const insertedSchools = insertMultipleRows(schools.map((school) => [
        school.izo,
        school.name,
        school.capacity.toString(),
    ]), "school", ["izo", "name", "capacity"], true);
    // const locations = schools.flatMap((school) => {
    //   const uniqueAddressPoints = [
    //     ...new Set(school.locations.map((location) => location.addressPointId)),
    //   ];
    //   return uniqueAddressPoints.map((addressPoint) => [
    //     school.izo,
    //     addressPoint.toString(),
    //   ]);
    // });
    const locations = schools
        .filter((school) => school.locations.length > 0)
        .map((school) => [
        school.izo,
        school.locations[0].addressPointId.toString(),
    ]);
    let insertedLocations = 0;
    // @todo prevent FK errors (address point might not exist, maybe even school?) - or maybe the DB wasn't fresh
    // plus filter out duplicit locations (same address id + izo)
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
