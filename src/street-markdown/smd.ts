import {
  checkStreetExists,
  findAddressPoints,
  getAddressPointById,
} from "../db/address-points";
import { setDbConfig } from "../db/db";
import { findFounder } from "../db/founders";
import { findSchool } from "../db/schools";
import {
  Founder,
  founderToMunicipality,
  Municipality as DbMunicipality,
} from "../db/types";
import { OpenDataSyncOptions, prepareOptions } from "../utils/helpers";
import {
  getSwitchMunicipality,
  getWholeMunicipality,
  isMunicipalitySwitch,
  isWholeMunicipality,
} from "./municipality";
import { parseLine } from "./smd-line-parser";
import {
  AddressPoint,
  ExportAddressPoint,
  isAddressPoint,
  Municipality,
  School,
} from "./types";

interface MunicipalityWithFounder extends Municipality {
  founder: Founder | null;
}

const getNewMunicipality = (name: string): MunicipalityWithFounder => {
  const { founder, errors } = findFounder(name);
  if (errors.length > 0) {
    errors.forEach(console.error);
  }
  return {
    municipalityName: founder ? founder.name : "Neznámá obec",
    founder,
    schools: [],
  };
};

const getNewSchool = (name: string, founder: Founder | null): School => {
  let exportSchool: School = {
    name: name,
    izo: "",
    addresses: [],
  };
  if (founder !== null) {
    const { school } = findSchool(name, founder.schools);
    if (school) {
      school.izo = school.izo || "";
      if (school.locations.length > 0) {
        const position = getAddressPointById(
          school.locations[0].addressPointId
        );
        if (position !== null) {
          exportSchool.position = position;
        }
      }
    }
  }
  return exportSchool;
};

const mapAddressPointForExport = (
  addressPoint: AddressPoint | ExportAddressPoint
): ExportAddressPoint => {
  return {
    address: addressPoint.address,
    lat: addressPoint.lat,
    lng: addressPoint.lng,
  };
};

const mapSchoolForExport = (school: School): School => ({
  name: school.name,
  izo: school.izo,
  addresses: school.addresses,
  position: mapAddressPointForExport(school.position),
});

const cleanLine = (line: string) => {
  return line.trim().replace(/–/g, "-");
};

export const parseOrdinanceToAddressPoints = (lines: string[], options: OpenDataSyncOptions = {}) => {
  const readyOptions = prepareOptions(options);
  setDbConfig({
    filePath: readyOptions.dbFilePath,
    initFilePath: readyOptions.dbInitFilePath,
  });
  
  let errorCount = 0;
  const errorLines: string[] = [];
  let warningCount = 0;
  let lineNumber = 1;
  let municipalities: Municipality[] = [];
  let currentMunicipality: MunicipalityWithFounder = null;
  let currentFilterMunicipality: DbMunicipality = null;
  let currentSchool: School = null;

  const reportErrors = (line: string, errors: string[]): void => {
    errors.forEach(console.error);
    console.error(`Invalid street definition on line ${lineNumber}: ${line}`);
    errorCount++;
    errorLines.push(`line ${lineNumber}: ${line}`);
  };

  lines.forEach((rawLine) => {
    let line = cleanLine(rawLine);

    if (line[0] === "#") {
      // a new municipality
      if (currentSchool !== null) {
        currentMunicipality.schools.push(currentSchool);
        currentSchool = null;
      }

      if (currentMunicipality !== null) {
        municipalities.push(convertMunicipality(currentMunicipality));
      }

      currentMunicipality = getNewMunicipality(line.substring(1).trim());
      currentFilterMunicipality = founderToMunicipality(
        currentMunicipality.founder
      );

      currentSchool = null;
    } else if (line === "") {
      // empty line (end of school)
      if (currentSchool !== null) {
        currentMunicipality.schools.push(currentSchool);
        currentSchool = null;
      }
    } else {
      if (currentSchool === null) {
        if (currentMunicipality === null) {
          throw new Error("No municipality defined on line " + lineNumber);
        }
        currentSchool = getNewSchool(line, currentMunicipality.founder);
        currentFilterMunicipality = founderToMunicipality(
          currentMunicipality.founder
        );
      } else {
        if (line[0] !== "!") {
          if (isMunicipalitySwitch(line)) {
            const { municipality, errors } = getSwitchMunicipality(line);
            if (errors.length > 0) {
              reportErrors(line, errors);
            } else {
              currentFilterMunicipality = municipality;
            }
          } else if (isWholeMunicipality(line)) {
            const { municipality, errors } = getWholeMunicipality(line);
            if (errors.length > 0) {
              reportErrors(line, errors);
            } else {
              const addressPoints = findAddressPoints(
                { wholeMunicipality: true, street: "", numberSpec: [] },
                municipality
              );
              currentSchool.addresses.push(
                ...filterOutSchoolAddressPoint(
                  addressPoints,
                  currentSchool
                ).map(mapAddressPointForExport)
              );
            }
          } else {
            // address point
            const { smdLines, errors } = parseLine(line);
            if (errors.length > 0) {
              reportErrors(line, errors);
            } else {
              smdLines.forEach((smdLine) => {
                const { exists, errors } = checkStreetExists(
                  smdLine.street,
                  currentMunicipality.founder
                );
                if (errors.length > 0) {
                  errors.map((error) => {
                    console.error(`Line ${lineNumber}: ${error}`);
                  });
                  warningCount++;
                }
                if (exists) {
                  let addressPoints = findAddressPoints(
                    smdLine,
                    currentFilterMunicipality
                  );

                  currentSchool.addresses.push(
                    ...filterOutSchoolAddressPoint(
                      addressPoints,
                      currentSchool
                    ).map(mapAddressPointForExport)
                  );
                }
              });
            }
          }
        }
      }
    }

    lineNumber++;
  });

  if (currentSchool != null) {
    if (currentMunicipality == null) {
      currentMunicipality = getNewMunicipality("");
    }
    currentMunicipality.schools.push(mapSchoolForExport(currentSchool));
  }

  if (currentMunicipality != null) {
    municipalities.push(convertMunicipality(currentMunicipality));
  }

  console.log(
    `Parsed ${lineNumber} lines, ${errorCount} errors, ${warningCount} warnings.`
  );
  if (errorCount > 0) {
    console.log("Errors:");
    errorLines.forEach((line) => console.log(line));
  }

  return municipalities;
};

const filterOutSchoolAddressPoint = (
  addressPoints: AddressPoint[],
  school: School
) => {
  const schoolPosition = school.position;
  return schoolPosition && isAddressPoint(schoolPosition)
    ? (addressPoints = addressPoints.filter(
        (ap) => ap.id !== schoolPosition.id
      ))
    : addressPoints;
};

export const convertMunicipality = (
  municipality: MunicipalityWithFounder
): Municipality => {
  return {
    municipalityName: municipality.municipalityName,
    schools: municipality.schools,
  };
};
