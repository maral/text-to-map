import { createReadStream, createWriteStream, existsSync, rmSync } from "fs";
import fetch from "node-fetch";
import { join } from "path";
import sax, { Tag } from "sax";

import { pipeline } from "stream/promises";
import { insertFounders } from "../db/founders";
import { insertSchools } from "../db/schools";
import {
  Founder,
  MunicipalityType,
  School,
  SchoolLocation,
  SyncPart,
} from "../db/types";
import {
  OpenDataSyncOptions,
  OpenDataSyncOptionsPartial,
  prepareOptions,
} from "../utils/helpers";
import { runSyncPart } from "./common";

const downloadXml = async (options: OpenDataSyncOptions): Promise<void> => {
  if (existsSync(getXmlFilePath(options))) {
    return;
  }

  console.log("Downloading a large XML file with school data...");
  const response = await fetch(options.schoolsXmlUrl);
  if (response.status !== 200) {
    throw new Error(
      `The XML file could not be downloaded. HTTP Code: ${response.status}`
    );
  }
  await pipeline(response.body, createWriteStream(getXmlFilePath(options)));
  console.log("Finished downloading.");
};

enum XMLState {
  None,
  RedIzo,
  SchoolName,
  Izo,
  Ico,
  SchoolType,
  Capacity,
  RuianCode,
  Address,
  FounderName,
  FounderType,
  FounderIco,
}

const SCHOOL_TYPE_PRIMARY = "B00";

const createNewSchool = (): School => {
  return {
    name: "",
    redizo: "",
    izo: "",
    capacity: 0,
    locations: [],
  };
};

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

type SchoolAddress = { izo: string; address: string[]; isPrimary: boolean };

const processSchoolRegisterXml = async (
  options: OpenDataSyncOptions
): Promise<{
  schools: School[];
  founders: Map<string, Founder>;
  schoolsWithoutRuian: SchoolAddress[];
}> => {
  let currentSchool: School;
  let isCurrentSchoolPrimary: boolean;
  let currentIzo: string;
  let currentIco: string;
  let currentType: string;
  let currentCapacity: number;
  let currentLocations: SchoolLocation[] = [];
  let state: XMLState = XMLState.None;
  let currentFounders = [];
  let currentFounderIco: string;
  let currentFounderName: string;
  let currentFounderType: string;
  let isRuianCodeSet = false;
  let isRuianCodeMissing = false;
  let currentAddress = [];
  const founders = new Map<string, Founder>();
  const schools: School[] = [];
  const schoolsWithoutRuian: SchoolAddress[] = [];

  const streamPromise = new Promise<void>((resolve, reject) => {
    const saxStream = sax
      .createStream(true)
      .on("opentag", (tag: Tag) => {
        switch (tag.name) {
          case "PravniSubjekt":
            currentSchool = createNewSchool();
            isCurrentSchoolPrimary = false;
            isRuianCodeMissing = false;
            break;
          case "RedIzo":
            state = XMLState.RedIzo;
            break;
          case "RedPlnyNazev":
            state = XMLState.SchoolName;
            break;
          case "IZO":
            state = XMLState.Izo;
            break;
          case "ICO":
            state = XMLState.Ico;
            break;
          case "SkolaDruhTyp":
            state = XMLState.SchoolType;
            break;
          case "SkolaKapacita":
            state = XMLState.Capacity;
            break;
          case "MistoRUAINKod":
            isRuianCodeSet = false;
            currentAddress = [];
            state = XMLState.RuianCode;
            break;
          case "ZrizNazev":
            state = XMLState.FounderName;
            break;
          case "ZrizPravniForma":
            state = XMLState.FounderType;
            break;
          case "MistoAdresa1":
          case "MistoAdresa2":
          case "MistoAdresa3":
            state = XMLState.Address;
            break;
          case "ZrizDatumNarozeni":
          case "ZrizICO":
            state = XMLState.FounderIco;
            break;
        }
      })
      .on("closetag", (tagName: string) => {
        switch (tagName) {
          case "PravniSubjekt":
            if (isCurrentSchoolPrimary) {
              schools.push(currentSchool);
              currentFounders.forEach((founder) => {
                const key = founder.name + founder.ico;
                if (founders.has(key)) {
                  founders.get(key).schools.push(currentSchool);
                } else {
                  founders.set(key, {
                    name: founder.name,
                    ico: founder.ico,
                    originalType: founder.type,
                    municipalityType: getMunicipalityType(founder.type),
                    schools: [currentSchool],
                  });
                }
              });
            }
            currentIco = "";
            currentFounders = [];
            break;

          case "Zrizovatel":
            if (currentFounderIco === "" || currentFounderName === "") {
              currentFounders.push({
                ico: currentIco,
                name: currentSchool.name,
                type: "224", // s.r.o (not all are those, but we don't need to differentiate here)
              });
            } else {
              currentFounders.push({
                ico: currentFounderIco,
                name: currentFounderName,
                type: getCorrectFounderType(currentFounderType),
              });
            }
            currentFounderIco = "";
            currentFounderName = "";
            currentFounderType = "";

            break;
          case "SkolaZarizeni":
            if (currentType === SCHOOL_TYPE_PRIMARY) {
              currentSchool.izo = currentIzo;
              currentSchool.locations = currentLocations;
              currentSchool.capacity = currentCapacity;
            }
            currentLocations = [];
            break;
          case "SkolaMistoVykonuCinnosti":
            if (isRuianCodeMissing) {
              schoolsWithoutRuian.push({
                izo: currentIzo,
                address: currentAddress,
                isPrimary: currentType === SCHOOL_TYPE_PRIMARY,
              });
            }
            break;
          case "MistoRUAINKod":
            isRuianCodeMissing = !isRuianCodeSet;
          case "RedPlnyNazev":
          case "RedIzo":
          case "ICO":
          case "IZO":
          case "SkolaDruhTyp":
          case "SkolaKapacita":
          case "ZrizNazev":
          case "ZrizICO":
          case "ZrizDatumNarozeni":
          case "ZrizPravniForma":
          case "MistoAdresa1":
          case "MistoAdresa2":
          case "MistoAdresa3":
            state = XMLState.None;
            break;
        }
      })
      .on("text", (text: string) => {
        switch (state) {
          case XMLState.RedIzo:
            currentSchool.redizo = text;
          case XMLState.SchoolName:
            currentSchool.name = text;
            break;
          case XMLState.Izo:
            currentIzo = text;
            break;
          case XMLState.Ico:
            currentIco = text;
            break;
          case XMLState.SchoolType:
            currentType = text;
            if (text === SCHOOL_TYPE_PRIMARY) {
              isCurrentSchoolPrimary = true;
            }
            break;
          case XMLState.RuianCode:
            isRuianCodeSet = true;
            currentLocations.push({
              addressPointId: parseInt(text),
            });
            break;
          case XMLState.Address:
            currentAddress.push(text);
            break;
          case XMLState.FounderName:
            currentFounderName = text;
            break;
          case XMLState.FounderIco:
            currentFounderIco = text;
            break;
          case XMLState.FounderType:
            currentFounderType = text;
            break;
          case XMLState.Capacity:
            currentCapacity = parseInt(text);
            break;
        }
      })
      .on("error", reject)
      .on("end", resolve);

    // wanted to use 'await pipeline(createReadStream(getXmlFilePath(options)), saxStream)'
    // but the program would quit spontaneously after finishing stream - using Promise instead.
    createReadStream(getXmlFilePath(options)).pipe(saxStream);
  });

  await streamPromise;

  return { schools, founders, schoolsWithoutRuian };
};

const importDataToDb = async (
  options: OpenDataSyncOptions,
  saveFoundersToCsv: boolean = false,
  saveSchoolsWithoutRuianToCsv: boolean = false
) => {
  const { schools, founders, schoolsWithoutRuian } =
    await processSchoolRegisterXml(options);

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
    csv.write("IZO;Je základní;adresa1;adresa2;adresa3\n");
    schoolsWithoutRuian.forEach((schoolAddress) => {
      csv.write(
        `#${schoolAddress.izo};${
          schoolAddress.isPrimary ? "TRUE" : "FALSE"
        };${schoolAddress.address.join(";")}\n`
      );
    });
    csv.end();
  }

  await insertSchools(schools);

  await insertFounders(Array.from(founders.values()));
};

const getXmlFilePath = (options: OpenDataSyncOptionsPartial): string => {
  return join(options.tmpDir, options.schoolsXmlFileName);
};

export const downloadAndImportSchools = async (
  options: OpenDataSyncOptionsPartial = {},
  saveFoundersToCsv: boolean = false,
  saveSchoolsWithoutRuianToCsv: boolean = false
) => {
  await runSyncPart(SyncPart.Schools, [SyncPart.AddressPoints], async () => {
    const runOptions = prepareOptions(options);

    await downloadXml(runOptions);
    await importDataToDb(
      runOptions,
      saveFoundersToCsv,
      saveSchoolsWithoutRuianToCsv
    );
    deleteSchoolsXmlFile(runOptions);
  });
};

export const deleteSchoolsXmlFile = (
  options: OpenDataSyncOptionsPartial = {}
) => {
  const runOptions = prepareOptions(options);

  if (existsSync(getXmlFilePath(runOptions))) {
    rmSync(getXmlFilePath(runOptions));
  }
};
