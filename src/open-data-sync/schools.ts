import request from "superagent";
import { createReadStream, createWriteStream, existsSync, rmSync } from "fs";
import { join } from "path";
import sax, { Tag } from "sax";
import fetch from "node-fetch";

import { insertFounders, insertSchools, setDbConfig } from "./search-db";
import {
  getAppDataDirPath,
  OpenDataSyncOptions,
  OpenDataSyncOptionsNotEmpty,
  prepareOptions,
} from "../utils/helpers";
import { pipeline } from "stream/promises";
import { Founder, MunicipalityType, School, SchoolLocation } from "./models";

const downloadXml = async (
  options: OpenDataSyncOptionsNotEmpty
): Promise<void> => {
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
    izo: "",
    capacity: 0,
    locations: [],
  };
};

const incorrectFoundersCitiesIcos = ["00245780", "00281727"];
const incorrectFoundersDistrictsIcos = [
  "44992785",
  "00241717",
  "00231134",
  "00241628",
  "00231215",
  "0084545116",
];

const getCorrectFounderType = (founderType: string, ico: string): string => {
  let type = founderType === "" ? "101" : founderType;
  // fix the mistakes in MŠMT data
  if (incorrectFoundersCitiesIcos.includes(ico)) {
    return "261"; // city
  } else if (incorrectFoundersDistrictsIcos.includes(ico)) {
    return "263"; // district
  }
  return type;
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
  options: OpenDataSyncOptionsNotEmpty
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
                type: getCorrectFounderType(
                  currentFounderType,
                  currentFounderIco
                ),
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
          case "ICO":
          case "IZO":
          case "SkolaDruhTyp":
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
  options: OpenDataSyncOptionsNotEmpty,
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

  setDbConfig({
    filePath: options.dbFilePath,
    initFilePath: options.dbInitFilePath,
  });

  insertSchools(schools);

  insertFounders(Array.from(founders.values()));
};

const getXmlFilePath = (options: OpenDataSyncOptions): string => {
  return join(options.tmpDir, options.schoolsXmlFileName);
};

export const downloadAndImportAllSchools = async (
  options: OpenDataSyncOptions
) => {
  const runOptions = prepareOptions(options);

  await downloadXml(runOptions);
  await importDataToDb(runOptions, false, true);
};