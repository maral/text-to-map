import { findMunicipalityByNameAndType } from "../db/founders";
import { MunicipalityType } from "../db/types";
import { DbMunicipalityResult } from "./types";

const municipalitySwitchPattern =
  /^navíc ulice (z )?(?<type>městské části|městského obvodu|obce|města) (?<name>.+):$/;

const wholeMunicipalityPattern =
  /^území (?<type>městské části|městského obvodu|obce|města) (?<name>.+)$/;

export const isMunicipalitySwitch = (line: string): boolean => {
  return municipalitySwitchPattern.test(line);
};

export const getSwitchMunicipality = (line: string): DbMunicipalityResult => {
  const match = municipalitySwitchPattern.exec(line);
  if (match === null) {
    throw new Error("Invalid municipality switch line");
  }
  const { type, name } = match.groups;
  return getMunicipalityResult(type, name);
};

export const isWholeMunicipality = (line: string): boolean => {
  return wholeMunicipalityPattern.test(line);
};

export const getWholeMunicipality = (line: string): DbMunicipalityResult => {
  const match = wholeMunicipalityPattern.exec(line);
  if (match === null) {
    return { errors: ["Invalid whole municipality line"], municipality: null };
  }
  const { type, name } = match.groups;
  return getMunicipalityResult(type, name);
};

const getMunicipalityResult = (
  type: string,
  name: string
): DbMunicipalityResult => {
  const typeValue = getMunicipalityType(type);
  const { municipality, errors } = findMunicipalityByNameAndType(
    name,
    typeValue
  );

  return {
    municipality,
    errors,
  };
};

const getMunicipalityType = (type: string): MunicipalityType => {
  switch (type) {
    case "městské části":
    case "městského obvodu":
      return MunicipalityType.District;
    case "obce":
    case "města":
      return MunicipalityType.City;
  }
};
