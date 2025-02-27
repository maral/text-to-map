import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Founder, MunicipalityType } from "../db/types";

const appName = "text-to-map";

export interface OpenDataSyncOptions {
  tmpDir: string;
  dataDir: string;
  dbFilePath: string;
  dbInitFilePath: string;
  addressPointsAtomUrl: string;
  addressPointsZipFileName: string;
  addressPointsCsvFolderName: string;
  streetsAtomUrl: string;
  streetZipFolderName: string;
  streetDbfFileName: string;
  polygonShpFileName: string;
  districtPolygonShpFileName: string;
  districtPolygonDbfFileName: string;
  schoolsXmlUrl: string;
  schoolsXmlFileName: string;
  regionsCsvUrl: string;
  regionsSchemaUrl: string;
  regionsCsvFileName: string;
}

export type OpenDataSyncOptionsPartial = Partial<OpenDataSyncOptions>;

export const getAppDataDirPath = (): string =>
  join(
    process.env.APPDATA ||
      (process.platform == "darwin"
        ? process.env.HOME + "/Library/Preferences"
        : process.env.HOME + "/.local/share"),
    appName
  );

export const prepareOptions = (
  options: OpenDataSyncOptionsPartial
): OpenDataSyncOptions => {
  const dataDir = options.dataDir ?? getAppDataDirPath();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir);
  }

  const tmpAppDir = join(tmpdir(), appName);
  if (!existsSync(tmpAppDir)) {
    mkdirSync(tmpAppDir);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const defaults: OpenDataSyncOptions = {
    tmpDir: tmpAppDir,
    dataDir: dataDir,
    dbFilePath: join(dataDir, "address_points.db"),
    dbInitFilePath: join(__dirname, "..", "address_points_init.db"),
    addressPointsAtomUrl:
      "https://atom.cuzk.cz/RUIAN-CSV-ADR-ST/RUIAN-CSV-ADR-ST.xml",
    addressPointsZipFileName: "ruian_csv.zip",
    addressPointsCsvFolderName: "CSV",
    streetsAtomUrl: "https://atom.cuzk.cz/RUIAN-OBCE-SHP/RUIAN-OBCE-SHP.xml",
    streetZipFolderName: "streets",
    streetDbfFileName: "UL_L.dbf",
    polygonShpFileName: "OBEC_P.shp",
    districtPolygonShpFileName: "MOMC_P.shp",
    districtPolygonDbfFileName: "MOMC_P.dbf",
    schoolsXmlUrl: "https://rejstriky.msmt.cz/opendata/vrejcelk.xml",
    schoolsXmlFileName: "school-register.xml",
    regionsCsvUrl:
      "https://www.czso.cz/documents/10180/23208674/struktura_uzemi_cr.csv",
    regionsSchemaUrl:
      "https://www.czso.cz/documents/10180/23208674/struktura_uzemi_cr-metadata.json",
    regionsCsvFileName: "struktura_uzemi_cr.csv",
  };

  return {
    ...defaults,
    ...options,
  };
};

const cityPatterns = [
  /^[sS]tatutární město +(.*)$/,
  /^[oO]bec +(.*)$/,
  /^[mM]ěsto +(.*)$/,
  /^[mM]ěstys +(.*)$/,
];

const districtPatterns = [
  /^[mM]ěstská část +(.*)$/,
  /^[mM]ěstský obvod +(.*)$/,
  /^[sS]tatutární město +.*, [mM]ěstská část +(.*)$/,
  /^[sS]tatutární město +.*, [mM]ěstský obvod +(.*)$/,
];

export const extractMunicipalityName = (founder: Founder): string => {
  const patterns =
    founder.municipalityType === MunicipalityType.City
      ? cityPatterns
      : districtPatterns;
  const correctPattern = patterns.filter((pattern) =>
    pattern.test(founder.name)
  );
  if (correctPattern.length > 0) {
    const result = correctPattern[0].exec(founder.name);
    if (typeof result[1] !== "undefined") {
      return result[1]
        .replace(" - ", "-")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  }

  return founder.name;
};

export const sanitizeMunicipalityName = (name: string): string => {
  return name
    .replace(" - ", "-")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export const findClosestString = (
  str: string,
  arr: string[],
  maxDistance?: number
): string | null => {
  let closestStr = "";
  let closestDistance = Number.MAX_SAFE_INTEGER;

  for (let i = 0; i < arr.length; i++) {
    const currentStr = arr[i];
    const distance = interpunctionDistance(str, currentStr);

    if (distance < closestDistance) {
      closestStr = currentStr;
      closestDistance = distance;
    }

    // exact match found, exit loop
    if (closestDistance === 0) {
      break;
    }
  }

  if (maxDistance !== undefined && closestDistance > maxDistance) {
    return "";
  }

  return closestStr;
};

const interpunctionDistance = (str1: string, str2: string): number => {
  let distance = levenshteinDistance(str1, str2);

  const interpunctionMistakes = {
    a: ["á"],
    á: ["a"],
    e: ["é", "ě"],
    é: ["e", "ě"],
    ě: ["e", "é"],
    i: ["í"],
    í: ["i"],
    y: ["ý"],
    ý: ["y"],
    o: ["ó"],
    ó: ["o"],
    u: ["ú", "ů"],
    ů: ["u", "ú"],
    ú: ["u", "ů"],
    c: ["č"],
    č: ["c"],
    d: ["ď"],
    ď: ["d"],
    n: ["ň"],
    ň: ["n"],
    r: ["ř"],
    ř: ["r"],
    s: ["š"],
    š: ["s"],
    t: ["ť"],
    ť: ["t"],
    z: ["ž"],
    ž: ["z"],
  };

  const str1Chars = str1.split("");
  const str2Chars = str2.split("");

  for (let i = 0; i < str1Chars.length; i++) {
    const char1 = str1Chars[i];
    const char2 = str2Chars[i];

    if (
      interpunctionMistakes[char1] &&
      interpunctionMistakes[char1].includes(char2)
    ) {
      // Subtract a penalty from the distance for interpunction mistakes
      distance -= 0.5;
    }
  }

  return distance;
};

const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] =
          Math.min(
            matrix[j][i - 1], // deletion
            matrix[j - 1][i], // insertion
            matrix[j - 1][i - 1] // substitution
          ) + 1;
      }
    }
  }

  return matrix[str2.length][str1.length];
};

export function roundToNDecimalPlaces(
  toRound: number,
  decimalPlaces: number
): number {
  return (
    Math.round(toRound * Math.pow(10, decimalPlaces)) /
    Math.pow(10, decimalPlaces)
  );
}
