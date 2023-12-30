var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { wholeLineError } from "../street-markdown/smd";
import { findClosestString } from "../utils/helpers";
import { getKnexDb, insertMultipleRows } from "./db";
export const insertSchools = (schools) => __awaiter(void 0, void 0, void 0, function* () {
    const knex = getKnexDb();
    const uniqueSchools = filterOutDuplicates(schools);
    const existingIzo = (yield knex.select("izo").from("school")).map((row) => row.izo);
    const toInsert = uniqueSchools.filter((school) => !existingIzo.includes(school.izo));
    const toUpdate = uniqueSchools.filter((school) => existingIzo.includes(school.izo));
    for (const school of toUpdate) {
        yield knex.from("school").where("izo", school.izo).update({
            name: school.name,
            capacity: school.capacity,
        });
    }
    const insertedSchools = yield insertMultipleRows(toInsert.map((school) => [
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
    for (const location of locations) {
        try {
            insertedLocations += yield insertMultipleRows([location], "school_location", ["school_izo", "address_point_id"], true);
        }
        catch (error) {
            console.log(`Cannot add location with RUIAN code ${location[1]} (school IZO = ${location[0]}): code does not exist.`);
        }
    }
    return insertedSchools + insertedLocations;
});
export const findSchool = (name, schools) => {
    if (schools.length === 0) {
        return {
            school: null,
            errors: [wholeLineError("Aktuální zřizovatel nemá žádné školy.", name)],
        };
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
    errors.push(wholeLineError(`Škola s názvem '${name}' neexistuje, mysleli jste '${bestMatch}'?`, name));
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
