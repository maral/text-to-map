import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Founder, MunicipalityType } from "../open-data-sync/models";

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

export const extractCityOrDistrictName = (founder: Founder): string => {
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
