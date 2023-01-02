import request from "superagent";
import { createReadStream, createWriteStream, existsSync, rmSync } from "fs";
import { join } from "path";
import sax, { Tag } from "sax";

import { insertSchool, School, SchoolLocation } from "./search-db";
import {
  getAppDataDirPath,
  OpenDataSyncOptions,
  OpenDataSyncOptionsNotEmpty,
  prepareOptions,
  reportError,
} from "../utils/helpers";

const downloadXml = (
  options: OpenDataSyncOptionsNotEmpty,
  onSuccess?: () => void
) => {
  if (existsSync(getXmlFilePath(options))) {
    if (typeof onSuccess !== "undefined") {
      onSuccess();
    }
    return;
  }

  console.log("downloading a large XML file with school data...");
  console.log(getXmlFilePath(options));
  request
    .get(options.schoolsXmlUrl)
    .on("error", function (error) {
      reportError(error);
    })
    .pipe(createWriteStream(getXmlFilePath(options)))
    .on("finish", function () {
      console.log("finished downloading");

      if (typeof onSuccess !== "undefined") {
        onSuccess();
      }
    });
};

interface SchoolState {
  isPrimary: boolean;
  school: School;
}

enum XMLState {
  None,
  SchoolName,
  Izo,
  Ico,
  SchoolType,
  Code,
  FounderName,
  FounderType,
  FounderIco,
}

const SCHOOL_TYPE_PRIMARY = "B00";

const createNewSchool = (): School => {
  return {
    name: "",
    izo: "",
    locations: [],
  };
};

let currentSchool: School;
let isCurrentSchoolPrimary: boolean;
let currentIzo: string;
let currentIco: string;
let currentType: string;
let currentLocations: SchoolLocation[] = [];
let state: XMLState = XMLState.None;
let founders: object = {};
let currentFounders = [];
let currentFounderIco: string;
let currentFounderName: string;
let currentFounderType: string;

const importDataToDb = (
  options: OpenDataSyncOptionsNotEmpty,
  onSuccess?: () => void
) => {
  const csvFile = "founders.csv";

  console.log(getAppDataDirPath());

  if (existsSync(csvFile)) {
    rmSync(csvFile);
  }

  const saxStream = sax
    .createStream(true)
    .on("opentag", (tag: Tag) => {
      switch (tag.name) {
        case "PravniSubjekt":
          currentSchool = createNewSchool();
          isCurrentSchoolPrimary = false;
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
        case "MistoRUAINKod":
          state = XMLState.Code;
          break;
        case "ZrizNazev":
          state = XMLState.FounderName;
          break;
        case "ZrizPravniForma":
          state = XMLState.FounderType;
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
            // insertSchool(currentSchool.school);
            // console.log("inserting school...");
            // console.log(currentSchool);
            // console.log(currentSchool.locations);
            currentFounders.forEach((founder) => {
              const key = founder.name + founder.ico;
              if (founders.hasOwnProperty(key)) {
                founders[key].count++;
                founders[key].schools.push(currentSchool.name);
              } else {
                founders[key] = {
                  name: founder.name,
                  ico: founder.ico,
                  type: founder.type,
                  count: 1,
                  schools: [currentSchool.name],
                };
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
              type: currentFounderType === "" ? "101" : currentFounderType, // physical person
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
        case "RedPlnyNazev":
        case "ICO":
        case "IZO":
        case "SkolaDruhTyp":
        case "MistoRUAINKod":
        case "ZrizNazev":
        case "ZrizICO":
        case "ZrizDatumNarozeni":
        case "ZrizPravniForma":
          state = XMLState.None;
          break;
        case "ExportDat":
          var csv = createWriteStream(csvFile, {
            flags: "a",
          });
          csv.write("IČO;Zřizovatel;Právní forma;Počet škol;Školy\n");
          Object.keys(founders).forEach((key) => {
            csv.write(
              `#${founders[key].ico};${founders[key].name};${
                founders[key].type
              };${founders[key].count};${founders[key].schools.join("---")}\n`
            );
          });
          csv.end();
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
        case XMLState.Code:
          currentLocations.push({
            addressPointId: parseInt(text),
          });
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
    });

  createReadStream(getXmlFilePath(options)).pipe(saxStream);

  // readdir(dataDir, (error, files) => {
  //   if (error) {
  //     reportError(error);
  //     return;
  //   }

  //   let total = 0;
  //   let next = 0;
  //   const promises = files.map(
  //     (file) =>
  //       new Promise<void>((resolve, reject) => {
  //         createReadStream(join(dataDir, file))
  //           .pipe(iconv.decodeStream("win1250"))
  //           .pipe(parse({ delimiter: ";", fromLine: 2 }))
  //           .on("data", (data) => {
  //             total += importParsedLine(data);
  //             if (total - next >= 100000) {
  //               next += 100000;
  //               console.log(`Total imported rows: ${next}`);
  //             }
  //           })
  //           .on("error", reportError)
  //           .on("end", function () {
  //             total += commitAddressPoints();
  //             resolve();
  //           });
  //       })
  //   );

  //   Promise.all(promises).then(() => {
  //     console.log(`Import completed. Total imported rows: ${total}`);
  //   });
  // });
};

const getXmlFilePath = (options: OpenDataSyncOptions): string => {
  return join(options.tmpDir, options.schoolsXmlFileName);
};

export const downloadAndImportAllSchools = (
  options: OpenDataSyncOptions,
  onSuccess?: () => void
) => {
  const runOptions = prepareOptions(options);

  downloadXml(runOptions, () => {
    importDataToDb(runOptions, onSuccess);
  });
};

downloadAndImportAllSchools({});
