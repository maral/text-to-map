import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import {
  Column,
  commitAddressPoints,
  disconnect,
  extractKeyValuesPairs,
  getDb,
  getMetaValue,
  importParsedLine,
  insertCities,
  insertDistricts,
  insertSchool,
  insertStreets,
  School,
  setMetaValue,
} from "../src/open-data-sync/search-db";
import jtsk2wgs84 from "@arodax/jtsk2wgs84";
import { rmSync } from "fs";

const testDbPath = "test-db.db";

const testRows = [
  [
    "82338752", // Kód ADM
    "500011", // Kód obce
    "Želechovice nad Dřevnicí", // Název obce
    "", // Kód MOMC
    "", // Název MOMC
    "", // Kód obvodu Prahy
    "", // Název obvodu Prahy
    "195901", // Kód části obce
    "Želechovice nad Dřevnicí", // Název části obce
    "644251", // Kód ulice
    "Lysá", // Název ulice
    "č.p.", // Typ SO
    "686", // Číslo domovní
    "", // Číslo orientační
    "", // Znak čísla orientačního
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
    "Želechovice nad Dřevnicí",
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
    "Želechovice nad Dřevnicí",
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
    "Želechovice nad Dřevnicí",
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

let testRowsLarge: string[][] = [];

beforeAll(() => {
  getDb({ filePath: testDbPath });

  let id = 1;
  for (let i = 0; i < 10000; i++) {
    testRowsLarge = testRowsLarge.concat(
      testRows.map((row) => [(id++).toString(), ...row.slice(1)])
    );
  }
});

afterAll(() => {
  disconnect();
  rmSync(testDbPath);
});

describe("search db - meta table", () => {
  test("get a non-existent meta value", () => {
    expect(getMetaValue("non-existent")).toBeUndefined();
  });

  test("set and read a meta value", () => {
    setMetaValue("testKey", 1);
    expect(getMetaValue("testKey")).toBe("1");
  });

  test("set, read, rewrite and read again a meta value", () => {
    setMetaValue("anotherKey", "abc");
    expect(getMetaValue("anotherKey")).toBe("abc");
    setMetaValue("anotherKey", "def");
    expect(getMetaValue("anotherKey")).toBe("def");
  });
});

describe("search db - address points", () => {
  // columns: Kód ADM	Kód obce	Název obce	Kód MOMC	Název MOMC	Kód obvodu Prahy	Název obvodu Prahy	Kód části obce	Název části obce	Kód ulice	Název ulice	Typ SO	Číslo domovní	Číslo orientační	Znak čísla orientačního	PSČ	Souřadnice Y	Souřadnice X	Platí Od

  test("JTSK to WGS84 conversion", () => {
    const latExpected = 49.20526945954302;
    const lonExpected = 17.748366340656077;
    const { lat, lon } = jtsk2wgs84(1167938.93, 515366.32);
    expect(Math.abs(lat - latExpected)).toBeLessThan(0.00001);
    expect(Math.abs(lon - lonExpected)).toBeLessThan(0.00001);
  });

  test("insert cities", () => {
    expect(insertCities(testRows)).toBe(1); // only 1 city in test data
    expect(insertCities(testRows)).toBe(0); // second try same values should be ignored, 0 new rows should be inserted
  });

  test("insert districts", () => {
    expect(insertDistricts(testRows)).toBe(0); // no district was filled, should be empty
  });

  test("insert streets", () => {
    expect(insertStreets(testRows)).toBe(2); // 2 streets in test data
    expect(insertStreets(testRows)).toBe(0);
  });

  test("insert whole rows", () => {
    testRows.forEach((data) => {
      importParsedLine(data);
    });
    expect(commitAddressPoints()).toBe(testRows.length);
  });

  test("insert whole rows with buffer overflow", () => {
    let total = 0;
    testRowsLarge.forEach((data, i) => {
      total += importParsedLine(data);
    });
    const commitCount = commitAddressPoints();
    expect(total + commitCount).toBe(testRowsLarge.length);
    expect(commitCount).toBeLessThan(testRowsLarge.length);
  });
});

describe("search db - schools", () => {
  const testSchools: School[] = [
    {
      izo: "044940998",
      name: "Církevní základní škola a mateřská škola Přemysla Pittra",
      locations: [
        {
          addressPointId: 82338752,
        },
        {
          addressPointId: 82499926,
        },
      ],
    },
    {
      izo: "042962358",
      name: "Základní škola a Mateřská škola Sluníčko s.r.o.",
      locations: [
        {
          addressPointId: 82660085,
        },
        {
          addressPointId: 83597492,
        },
      ],
    },
  ];

  test("insert schools", () => {
    let total = 0;
    testSchools.forEach((school) => {
      total += insertSchool(school);
    });

    expect(total).toBe(testSchools.length);
  });
});
