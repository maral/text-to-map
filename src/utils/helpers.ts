import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

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
