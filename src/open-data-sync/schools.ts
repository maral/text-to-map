import { createReadStream, createWriteStream, existsSync, rmSync } from "fs";
import fetch from "node-fetch";
import { join } from "path";
import parser from "stream-json";
import Pick from "stream-json/filters/Pick";
import StreamArray from "stream-json/streamers/StreamArray";

import { pipeline } from "stream/promises";
import { insertFounders } from "../db/founders";
import { insertSchools } from "../db/schools";
import { getKnexDb } from "../db/db";
import {
  Founder,
  MunicipalityType,
  School,
  SchoolLocation,
  SchoolType,
  SyncPart,
} from "../db/types";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsPartial,
  prepareOptions,
} from "../utils/helpers";
import { runSyncPart } from "./common";

const downloadJsonld = async (options: OpenDataSyncOptions): Promise<void> => {
  if (existsSync(getJsonldFilePath(options))) {
    return;
  }

  console.log("Downloading a large JSON-LD file with school data...");
  const response = await fetch(options.schoolsJsonldUrl);
  if (response.status !== 200) {
    throw new Error(
      `The JSON-LD file could not be downloaded. HTTP Code: ${response.status}`
    );
  }
  await pipeline(response.body, createWriteStream(getJsonldFilePath(options)));
  console.log("Finished downloading.");
};

const SCHOOL_TYPE_KINDERGARTEN = "A00";
const SCHOOL_TYPE_ELEMENTARY = "B00";

const getCorrectFounderType = (founderType: string): string => {
  return founderType === "" ? "101" : founderType;
};

const getMunicipalityType = (founderType: string): MunicipalityType => {
  return founderType === "261"
    ? MunicipalityType.City
    : founderType === "263"
    ? MunicipalityType.District
    : MunicipalityType.Other;
};

type SchoolAddress = {
  izo: string;
  address: string[];
  type: SchoolType;
};

const processSchoolRegisterJsonld = async (
  options: OpenDataSyncOptions
): Promise<{
  schools: School[];
  founders: Map<string, Founder>;
  schoolsWithoutRuian: SchoolAddress[];
}> => {
  const founders = new Map<string, Founder>();
  const schools: School[] = [];
  const schoolsWithoutRuian: SchoolAddress[] = [];

  const stream = createReadStream(getJsonldFilePath(options))
    .pipe(parser())
    .pipe(new Pick({ filter: "list" }))
    .pipe(new StreamArray());

  for await (const { value: entity } of stream) {
    const redizo: string = entity.redIzo ?? "";
    const ico: string = entity.ico ?? "";
    const entityName: string = entity.uplnyNazev ?? "";
    const currentSchools: School[] = [];

    for (const school of entity.skolyAZarizeni ?? []) {
      const type =
        school.druh === SCHOOL_TYPE_KINDERGARTEN
          ? SchoolType.Kindergarten
          : school.druh === SCHOOL_TYPE_ELEMENTARY
          ? SchoolType.Elementary
          : null;

      if (type === null) continue;

      const capacityEntry =
        school.kapacity?.find((k) => k.mernaJednotka === "01") ??
        school.kapacity?.[0];
      const capacity: number = capacityEntry?.nejvyssiPovolenyPocet ?? 0;
      const allPlaces = school.mistaVyuky ?? [];
      const locationsWithRuian = allPlaces.filter(
        (p) => p.adresa?.kodRUIAN != null
      );
      // Prefer the main building (IDmista matches school IZO), fall back to first available
      const mainPlace =
        locationsWithRuian.find((p) => p.IDmista === school.izo) ??
        locationsWithRuian[0];

      const locations: SchoolLocation[] = mainPlace
        ? [{ addressPointId: mainPlace.adresa.kodRUIAN }]
        : [];

      if (!mainPlace && allPlaces.length > 0) {
        const addr = allPlaces[0].adresa ?? {};
        const addressParts = [
          addr.ulice,
          addr.cisloDomovni?.toString(),
          addr.obec,
        ].filter(Boolean);
        schoolsWithoutRuian.push({ izo: school.izo, address: addressParts, type });
      }

      currentSchools.push({
        izo: school.izo,
        name: entityName || school.uplnyNazev || "",
        redizo,
        capacity,
        type,
        locations,
      });
    }

    schools.push(...currentSchools);

    for (const z of entity.zrizovatele ?? []) {
      let founderIco: string;
      let founderName: string;
      let founderType: string;

      if (z.druhOsoby === "PO") {
        founderIco = z.Ico ?? "";
        founderName = z.nazevOsoby ?? "";
        founderType = getCorrectFounderType(z.pravniForma ?? "");
      } else {
        founderIco = z.datumNarozeni ?? "";
        founderName = z.nazevOsoby ?? "";
        founderType = getCorrectFounderType("");
      }

      if (founderIco === "" || founderName === "") {
        founderIco = ico;
        founderName = entityName;
        founderType = "224";
      }

      if (currentSchools.length > 0) {
        const key = founderName + founderIco;
        if (founders.has(key)) {
          founders.get(key).schools.push(...currentSchools);
        } else {
          founders.set(key, {
            name: founderName,
            ico: founderIco,
            originalType: parseInt(founderType),
            municipalityType: getMunicipalityType(founderType),
            schools: [...currentSchools],
          });
        }
      }
    }
  }

  return { schools, founders, schoolsWithoutRuian };
};

const importDataToDb = async (
  options: OpenDataSyncOptions,
  saveFoundersToCsv: boolean = false,
  saveSchoolsWithoutRuianToCsv: boolean = false
) => {
  const { schools, founders, schoolsWithoutRuian } =
    await processSchoolRegisterJsonld(options);

  if (saveFoundersToCsv) {
    const csvFile = "founders.csv";

    if (existsSync(csvFile)) {
      rmSync(csvFile);
    }

    var csv = createWriteStream(csvFile, {
      flags: "a",
    });
    csv.write("IČO;Zřizovatel;Právní forma;Počet škol;Školy\n");
    founders.forEach((founder) => {
      csv.write(
        `#${founder.ico};${founder.name};${founder.originalType};${
          founder.schools.length
        };${founder.schools.map((school) => school.name).join("---")}\n`
      );
    });
    csv.end();
  }

  if (saveSchoolsWithoutRuianToCsv) {
    const csvFile = "schoolsWithoutRuian.csv";

    if (existsSync(csvFile)) {
      rmSync(csvFile);
    }

    var csv = createWriteStream(csvFile, {
      flags: "a",
    });
    csv.write("IZO;Je mateřská;Je základní;adresa1;adresa2;adresa3\n");
    schoolsWithoutRuian.forEach((schoolAddress) => {
      csv.write(
        `#${schoolAddress.izo};${
          schoolAddress.type === SchoolType.Kindergarten ? "TRUE" : "FALSE"
        };${
          schoolAddress.type === SchoolType.Elementary ? "TRUE" : "FALSE"
        };${schoolAddress.address.join(";")}\n`
      );
    });
    csv.end();
  }

  const knex = getKnexDb();
  const schoolsBefore = (await knex("school").count("izo as count").first()).count as number;
  const foundersBefore = (await knex("founder").count("id as count").first()).count as number;

  // Compute change stats before inserting (uses same logic as insertSchools)
  const existingSnap: { izo: string; name: string; capacity: number; address_point_id: number | null }[] =
    await knex("school")
      .leftJoin("school_location", "school.izo", "school_location.school_izo")
      .select("school.izo", "school.name", "school.capacity", "school_location.address_point_id");
  const existingSnapMap = new Map(existingSnap.map((r) => [r.izo, r]));
  const statsFieldUpdates = schools.filter((s) => {
    const row = existingSnapMap.get(s.izo);
    return row && (row.name !== s.name || row.capacity !== s.capacity);
  }).length;
  const statsLocationUpdates = schools.filter((s) => {
    const row = existingSnapMap.get(s.izo);
    const newRuians = s.locations.map((l) => l.addressPointId);
    return row && row.address_point_id !== null && newRuians.length > 0 && !newRuians.includes(row.address_point_id);
  }).length;

  await insertSchools(schools);
  await insertFounders(Array.from(founders.values()));

  const schoolsAfter = (await knex("school").count("izo as count").first()).count as number;
  const foundersAfter = (await knex("founder").count("id as count").first()).count as number;

  const kindergartens = schools.filter((s) => s.type === SchoolType.Kindergarten).length;
  const elementary = schools.filter((s) => s.type === SchoolType.Elementary).length;

  console.log(`\n=== School sync statistics ===`);
  console.log(`Schools parsed:         ${schools.length} (${kindergartens} kindergartens, ${elementary} elementary)`);
  console.log(`Founders parsed:        ${founders.size}`);
  console.log(`New schools inserted:   ${schoolsAfter - schoolsBefore}`);
  console.log(`New founders inserted:  ${foundersAfter - foundersBefore}`);
  console.log(`Field updates:          ${statsFieldUpdates} (name/capacity changed)`);
  console.log(`Location updates:       ${statsLocationUpdates} (first location changed)`);
  console.log(`Total schools in DB:    ${schoolsAfter}`);
  console.log(`Total founders in DB:   ${foundersAfter}`);
};

const getJsonldFilePath = (options: OpenDataSyncOptionsPartial): string => {
  return join(options.tmpDir, options.schoolsJsonldFileName);
};

export const downloadAndImportSchools = async (
  options: OpenDataSyncOptionsPartial = {},
  saveFoundersToCsv: boolean = false,
  saveSchoolsWithoutRuianToCsv: boolean = false
) => {
  await runSyncPart(SyncPart.Schools, [SyncPart.AddressPoints], async () => {
    const runOptions = prepareOptions(options);

    await downloadJsonld(runOptions);
    await importDataToDb(
      runOptions,
      saveFoundersToCsv,
      saveSchoolsWithoutRuianToCsv
    );
    deleteSchoolsJsonldFile(runOptions);
  });
};

export const deleteSchoolsJsonldFile = (
  options: OpenDataSyncOptionsPartial = {}
) => {
  const runOptions = prepareOptions(options);

  if (existsSync(getJsonldFilePath(runOptions))) {
    rmSync(getJsonldFilePath(runOptions));
  }
};
