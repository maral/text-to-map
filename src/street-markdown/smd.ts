import { findAddressPoints, getAddressPointById } from "../db/address-points";
import { findFounder } from "../db/founders";
import { findSchool } from "../db/schools";
import { Founder } from "../db/types";
import { parseLine } from "./smd-line-parser";
import { Municipality, School } from "./types";

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

const cleanLine = (line: string) => {
  return line.trim().replace(/–/g, "-");
};

export const parseOrdinanceToAddressPoints = (lines: string[]) => {
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
          const { smdLine, errors } = parseLine(s);
          if (errors.length > 0) {
            errors.forEach(console.error);
            console.error(
              "Invalid address point on line " + lineNumber + ": " + s
            );
          } else {
            const addressPoints = findAddressPoints(
              smdLine,
              currentMunicipality.founder
            );
            currentSchool.addresses.push(...addressPoints);
          }
        } else {
          // street definition
          console.error("Invalid street line on line " + lineNumber + ": " + s);
        }
      }
    }

    lineNumber++;
  });

  if (currentSchool != null) {
    if (currentMunicipality == null) {
      currentMunicipality = getNewMunicipality("");
    }
    currentMunicipality.schools.push(currentSchool);
  }

  if (currentMunicipality != null) {
    municipalities.push(convertMunicipality(currentMunicipality));
  }

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
