import {
  findMunicipalityByNameAndType,
  findMunicipalityPartByName,
} from "../db/founders";
import { Founder, MunicipalityType } from "../db/types";
import { DbMunicipalityResult, MunicipalityPartResult } from "./types";

const municipalityPartPattern = /^část (?<type>obce|města) (?<name>.+)$/;

const municipalitySwitchStartPattern = /^navíc ulice /;

const municipalitySwitchPattern =
  /^navíc ulice (z )?(?<type>městské části|městského obvodu|obce|města) (?<name>.+):$/;

const wholeMunicipalityStartPattern = /^území /;

const wholeMunicipalityPattern =
  /^území (?<type>městské části|městského obvodu|obce|města) (?<name>.+)$/;

const noStreetNamePattern = /^všechny ostatní budovy bez názvu ulice\s*$/;

export const isMunicipalityPart = (line: string): boolean => {
  return municipalityPartPattern.test(line);
};

export const getMunicipalityPart = async (
  line: string,
  founder: Founder
): Promise<MunicipalityPartResult> => {
  const match = municipalityPartPattern.exec(line);
  if (match === null) {
    return {
      errors: [
        {
          message:
            "Neplatný zápis pro přidání části obce. Správný zápis je: části <obce/města> <název části obce>. Např.: 'části obce Kladno' (název části obce musí být v 1. pádě).",
          startOffset: 0,
          endOffset: line.length + 1,
        },
      ],
      municipalityPartCode: null,
    };
  }
  const { name } = match.groups;
  return await getMunicipalityPartResult(cleanName(name), line, founder);
};

export const isMunicipalitySwitch = (line: string): boolean => {
  return municipalitySwitchStartPattern.test(line);
};

export const getSwitchMunicipality = async (
  line: string,
  founder: Founder
): Promise<DbMunicipalityResult> => {
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
  return await getMunicipalityResult(type, cleanName(name), line, founder);
};

export const isWholeMunicipality = (line: string): boolean => {
  return wholeMunicipalityStartPattern.test(line);
};

export const isNoStreetNameLine = (line: string): boolean => {
  return noStreetNamePattern.test(line);
};

export const getWholeMunicipality = async (
  line: string,
  founder: Founder
): Promise<DbMunicipalityResult> => {
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
  return await getMunicipalityResult(type, cleanName(name), line, founder);
};

const getMunicipalityResult = async (
  type: string,
  name: string,
  line: string,
  founder: Founder
): Promise<DbMunicipalityResult> => {
  const typeValue = getMunicipalityType(type);
  const { municipality, errors } = await findMunicipalityByNameAndType(
    name,
    typeValue,
    founder
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

const getMunicipalityPartResult = async (
  name: string,
  line: string,
  founder: Founder
): Promise<MunicipalityPartResult> => {
  const { municipalityPartCode, errors } = await findMunicipalityPartByName(
    name,
    founder
  );

  const startOffset = line.indexOf(name);
  const endOffset = startOffset + name.length + 1;

  return {
    municipalityPartCode,
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

const cleanName = (name: string): string => {
  return name.trim();
}