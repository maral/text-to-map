import { findMunicipalityByNameAndType } from "../db/founders";
import { MunicipalityType } from "../db/types";
import { DbMunicipalityResult } from "./types";

const municipalitySwitchStartPattern = /^navíc ulice /;

const municipalitySwitchPattern =
  /^navíc ulice (z )?(?<type>městské části|městského obvodu|obce|města) (?<name>.+):$/;

const wholeMunicipalityStartPattern = /^území /;

const wholeMunicipalityPattern =
  /^území (?<type>městské části|městského obvodu|obce|města) (?<name>.+)$/;

export const isMunicipalitySwitch = (line: string): boolean => {
  return municipalitySwitchStartPattern.test(line);
};

export const getSwitchMunicipality = (line: string): DbMunicipalityResult => {
  const match = municipalitySwitchPattern.exec(line);
  if (match === null) {
    return {
      errors: [
        {
          message:
            "Neplatný zápis pro dočasnou změnu obce v definici ulic. Správný zápis je: navíc ulice <typ> <název obce>. Např.: 'navíc ulice obce Mokrá Lhota:' (název obce musí být v 1. pádě).",
          startOffset: 0,
          endOffset: line.length + 1,
        },
      ],
      municipality: null,
    };
  }
  const { type, name } = match.groups;
  return getMunicipalityResult(type, name, line);
};

export const isWholeMunicipality = (line: string): boolean => {
  return wholeMunicipalityStartPattern.test(line);
};

export const getWholeMunicipality = (line: string): DbMunicipalityResult => {
  const match = wholeMunicipalityPattern.exec(line);
  if (match === null) {
    return {
      errors: [
        {
          message:
            "Neplatný zápis pro přidání celé obce. Správný zápis je: území <typ> <název obce>. Např.: 'území obce Kladno' (název obce musí být v 1. pádě).",
          startOffset: 0,
          endOffset: line.length + 1,
        },
      ],
      municipality: null,
    };
  }
  const { type, name } = match.groups;
  return getMunicipalityResult(type, name, line);
};

const getMunicipalityResult = (
  type: string,
  name: string,
  line: string
): DbMunicipalityResult => {
  const typeValue = getMunicipalityType(type);
  const { municipality, errors } = findMunicipalityByNameAndType(
    name,
    typeValue
  );

  const startOffset = line.indexOf(name);
  const endOffset = startOffset + name.length + 1;

  return {
    municipality,
    errors: errors.map((error) => ({
      ...error,
      startOffset,
      endOffset,
    })),
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
