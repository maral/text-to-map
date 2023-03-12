import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Founder, MunicipalityType } from "../db/types";

const appName = "text-to-map";

export interface OpenDataSyncOptions {
  tmpDir?: string;
  dataDir?: string;
  dbFilePath?: string;
  dbInitFilePath?: string;
  addressPointsAtomUrl?: string;
  addressPointsZipFileName?: string;
  addressPointsCsvFolderName?: string;
  schoolsXmlUrl?: string;
  schoolsXmlFileName?: string;
}

export interface OpenDataSyncOptionsNotEmpty {
  tmpDir: string;
  dataDir: string;
  dbFilePath: string;
  dbInitFilePath: string;
  addressPointsAtomUrl: string;
  addressPointsZipFileName: string;
  addressPointsCsvFolderName: string;
  schoolsXmlUrl: string;
  schoolsXmlFileName: string;
}

export const getAppDataDirPath = (): string =>
  join(
    process.env.APPDATA ||
      (process.platform == "darwin"
        ? process.env.HOME + "/Library/Preferences"
        : process.env.HOME + "/.local/share"),
    appName
  );

export const prepareOptions = (
  options: OpenDataSyncOptions
): OpenDataSyncOptionsNotEmpty => {
  const dataDir = options.dataDir ?? getAppDataDirPath();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir);
  }

  const tmpAppDir = join(tmpdir(), appName);
  if (!existsSync(tmpAppDir)) {
    mkdirSync(tmpAppDir);
  }

  return {
    tmpDir: options.tmpDir ?? tmpAppDir,
    dataDir: dataDir,
    dbFilePath: options.dbFilePath ?? join(dataDir, "address_points.db"),
    dbInitFilePath:
      options.dbInitFilePath ?? join("src", "address_points_init.db"),
    addressPointsAtomUrl:
      options.addressPointsAtomUrl ??
      "https://atom.cuzk.cz/RUIAN-CSV-ADR-ST/RUIAN-CSV-ADR-ST.xml",
    addressPointsZipFileName:
      options.addressPointsZipFileName ?? "ruian_csv.zip",
    addressPointsCsvFolderName: options.addressPointsCsvFolderName ?? "CSV",
    schoolsXmlUrl:
      options.schoolsXmlUrl ??
      "https://rejstriky.msmt.cz/opendata/vrejcelk.xml",
    schoolsXmlFileName: options.schoolsXmlFileName ?? "school-register.xml",
  };
};

export const reportError = (error: any): void => {
  if (error.hasOwnProperty("stack")) {
    console.log(error, error.stack);
  } else {
    console.log(error);
  }
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

export const findClosestString = (str: string, arr: string[]): string => {
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
