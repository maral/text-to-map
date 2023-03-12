import { readFileSync } from "fs";
import { findFounder } from "../db/schools";
import { Founder, School } from "../db/types";

interface Municipality {
  name: string;
  schools: School[];
}

interface MunicipalityWithFounder {
  name: string;
  founder: Founder;
  schools: School[];
}

const getNewMunicipality = (
  name?: string
): MunicipalityWithFounder | Municipality => {
  if (name) {
    const { founder } = findFounder(name);
    return {
      name: founder.name,
      founder,
      schools: [],
    };
  } else {
    return {
      name: "Neznámá obec",
      schools: [],
    };
  }
};

const getNewSchool = (name: string) => {
  return {
    name: name,
    lines: [],
  };
};

const cleanLine = (line: string) => {
  return line
    .trim()
    .replace(/ +(?= )/g, "")
    .replace(/–/g, "-")
    .replace(/nábř\./g, "nábřeží")
    .replace(/Nábř\./g, "Nábřeží")
    .replace(/nám\./g, "náměstí")
    .replace(/Nám\./g, "Náměstí");
};

export const parseOrdinanceToAddressPoints = (filePath: string) => {
  const fileContent = readFileSync(filePath);
  const lines = fileContent.toString().split("\n");

  let lineNumber = 1;
  let municipalities: Municipality[] = [];
  let currentMunicipality: MunicipalityWithFounder | Municipality = null;
  let currentSchool = null;

  lines.forEach((line) => {
    let s = cleanLine(line);

    if (s[0] == "#") {
      // a new municipality
      if (currentSchool != null) {
        currentMunicipality.schools.push(currentSchool);
        currentSchool = null;
      }

      if (currentMunicipality != null) {
        municipalities.push(convertMunicipality(currentMunicipality));
      }

      currentMunicipality = getNewMunicipality(s.substring(1).trim());

      currentSchool = null;
    } else if (s == "") {
      // empty line (end of school)
      if (currentSchool != null) {
        if (currentMunicipality == null) {
          currentMunicipality = getNewMunicipality("");
        }
        currentMunicipality.schools.push(currentSchool);
        currentSchool = null;
      }
    } else {
      if (currentSchool == null) {
        if (currentMunicipality == null) {
          currentMunicipality = getNewMunicipality("");
        }
        currentSchool = getNewSchool(s);
      } else {
        if (s[0] == "!") {
          currentSchool.lines.push(s);
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
  municipality: Municipality | MunicipalityWithFounder
): Municipality => {
  return {
    name: municipality.name,
    schools: municipality.schools,
  };
};
