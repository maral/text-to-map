import { rmSync } from "fs";
import { Knex } from "knex";
import { SupportedDbType, disconnectKnex, initDb } from "../../src/db/db";
import {
  Founder,
  MunicipalityType,
  School,
  SchoolType,
} from "../../src/db/types";

const testDbPath = "test-db.db";

export const testRows = [
  [
    "82338752", // Kód ADM
    "500011", // Kód obce
    "Želechovice nad Dřevnicí", // Název obce
    "", // Kód MOMC
    "", // Název MOMC
    "", // Kód obvodu Prahy
    "", // Název obvodu Prahy
    "195901", // Kód části obce
    "Dřevník", // Název části obce
    "644251", // Kód ulice
    "Lysá", // Název ulice
    "č.p.", // Typ SO
    "686", // Číslo domovní
    "20", // Číslo orientační
    "a", // Znak čísla orientačního
    "76311", // PSČ
    "516081.77", // Souřadnice Y
    "1166800.80", // Souřadnice X
    "2021-12-13T00:00:00", // Platí Od
  ],
  [
    "82499926",
    "500011",
    "Želechovice nad Dřevnicí",
    "",
    "",
    "",
    "",
    "195901",
    "Dřevník",
    "647268",
    "Paseky",
    "č.p.",
    "690",
    "",
    "",
    "76311",
    "516029.65",
    "1167771.23",
    "2022-01-18T00:00:00",
  ],
  [
    "82660085",
    "500011",
    "Želechovice nad Dřevnicí",
    "",
    "",
    "",
    "",
    "195901",
    "Dřevník",
    "647268",
    "Paseky",
    "č.ev.",
    "88",
    "",
    "",
    "76311",
    "516284.70",
    "1167128.53",
    "2022-03-09T00:00:00",
  ],
  [
    "83597492",
    "500011",
    "Želechovice nad Dřevnicí",
    "",
    "",
    "",
    "",
    "195901",
    "Dřevník",
    "",
    "",
    "č.p.",
    "695",
    "",
    "",
    "76311",
    "515366.32",
    "1167938.93",
    "2022-10-17T00:00:00",
  ],
];

export const testSchools: School[] = [
  {
    type: SchoolType.Elementary,
    izo: "044940998",
    redizo: "600001733",
    name: "Církevní základní škola a mateřská škola Přemysla Pittra",
    capacity: 300,
    locations: [
      {
        addressPointId: 82338752,
      },
    ],
  },
  {
    type: SchoolType.Elementary,
    izo: "042962358",
    redizo: "600001741",
    name: "Základní škola a Mateřská škola Sluníčko s.r.o.",
    capacity: 58,
    locations: [
      {
        addressPointId: 82660085,
      },
    ],
  },
];

export const testFounders: Founder[] = [
  {
    ico: "00000000",
    name: "Město Želechovice nad Dřevnicí",
    municipalityType: MunicipalityType.City,
    schools: testSchools,
    originalType: 261,
    municipalityCode: 500011,
  },
];

export const setupDb = async (dbFileNamePrefix?: string): Promise<Knex> => {
  return await initDb({
    dbType: SupportedDbType.sqlite,
    filePath: getFullDbPath(dbFileNamePrefix),
  });
};

export const closeDb = async (dbFileNamePrefix?: string) => {
  await disconnectKnex();
  rmSync(getFullDbPath(dbFileNamePrefix));
};

const getFullDbPath = (dbFileNamePrefix?: string) => {
  return dbFileNamePrefix ? `${dbFileNamePrefix}.${testDbPath}` : testDbPath;
};
