import {
  checkStreetExists,
  findAddressPoints,
  getAddressPointById,
} from "../db/address-points";
import { findFounder } from "../db/founders";
import { findSchool } from "../db/schools";
import { Founder } from "../db/types";
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
    addresses: [],
  };
  if (founder !== null) {
    const { school } = findSchool(name, founder.schools);
    if (school && school.locations.length > 0) {
      const position = getAddressPointById(school.locations[0].addressPointId);
      if (position !== null) {
        exportSchool.position = position;
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
  addresses: school.addresses,
  position: mapAddressPointForExport(school.position),
});

const cleanLine = (line: string) => {
  return line.trim().replace(/–/g, "-");
};

export const parseOrdinanceToAddressPoints = (lines: string[]) => {
  let errorLines = 0;
  let lineNumber = 1;
  let municipalities: Municipality[] = [];
  let currentMunicipality: MunicipalityWithFounder = null;
  let currentSchool: School = null;

  lines.forEach((line) => {
    let s = cleanLine(line);

    if (s[0] === "#") {
      // a new municipality
      if (currentSchool !== null) {
        currentMunicipality.schools.push(currentSchool);
        currentSchool = null;
      }

      if (currentMunicipality !== null) {
        municipalities.push(convertMunicipality(currentMunicipality));
      }

      currentMunicipality = getNewMunicipality(s.substring(1).trim());

      currentSchool = null;
    } else if (s === "") {
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
        currentSchool = getNewSchool(s, currentMunicipality.founder);
      } else {
        if (s[0] !== "!") {
          // address point
          const { smdLines, errors } = parseLine(s);
          if (errors.length > 0) {
            errors.forEach(console.error);
            console.error(
              `Invalid street definition on line ${lineNumber}: ${s}`
            );
            errorLines++;
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
                errorLines++;
              }
              if (exists) {
                let addressPoints = findAddressPoints(
                  smdLine,
                  currentMunicipality.founder
                );

                // filter out school address point
                const schoolPosition = currentSchool.position;
                if (schoolPosition && isAddressPoint(schoolPosition)) {
                  addressPoints = addressPoints.filter(
                    (ap) => ap.id !== schoolPosition.id
                  );
                }
                currentSchool.addresses.push(
                  ...addressPoints.map(mapAddressPointForExport)
                );
              }
            });
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

  console.log(`Parsed ${lineNumber} lines, ${errorLines} errors.`);

  return municipalities;
};

export const convertMunicipality = (
  municipality: MunicipalityWithFounder
): Municipality => {
  return {
    municipalityName: municipality.municipalityName,
    schools: municipality.schools,
  };
};
