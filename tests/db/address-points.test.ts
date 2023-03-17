import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import jtsk2wgs84 from "@arodax/jtsk2wgs84";
import { closeDb, setupDb, testFounders, testRows } from "./db-setup";
import {
  importParsedLine,
  commitAddressPoints,
  insertCities,
  insertDistricts,
  insertStreets,
  insertMunicipalityParts,
  isInRange,
  fitsType,
  findAddressPoints,
  equalsFullStreetNumber,
} from "../../src/db/address-points";
import { AddressPoint, SeriesType } from "../../src/street-markdown/types";

// let testRowsLarge: string[][] = [];
const prefix = "address-points";
beforeAll(() => {
  setupDb(prefix);

  // let id = 1;
  // for (let i = 0; i < 10000; i++) {
  //   testRowsLarge = testRowsLarge.concat(
  //     testRows.map((row) => [(id++).toString(), ...row.slice(1)])
  //   );
  // }
});

afterAll(() => {
  closeDb(prefix);
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

  test("insert municipality parts", () => {
    expect(insertMunicipalityParts(testRows)).toBe(1); // 1 municipality in test data
    expect(insertMunicipalityParts(testRows)).toBe(0);
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

  // test("insert whole rows with buffer overflow", () => {
  //   let total = 0;
  //   testRowsLarge.forEach((data, i) => {
  //     total += importParsedLine(data);
  //   });
  //   const commitCount = commitAddressPoints();
  //   expect(total + commitCount).toBe(testRowsLarge.length);
  //   expect(commitCount).toBeLessThan(testRowsLarge.length);
  // });

  // test("check db", () => {
  //   const db = setupDb(prefix);
  //   const stmt = db.prepare("SELECT * FROM address_point");
  //   const result = stmt.all();
  //   expect(result["COUNT(*)"]).toBe(1);
  // });
});

describe("find address points", () => {
  test("fits type", () => {
    expect(fitsType(1, SeriesType.All)).toBe(true);
    expect(fitsType(1000, SeriesType.All)).toBe(true);
    expect(fitsType(1, SeriesType.Descriptive)).toBe(true);
    expect(fitsType(1000, SeriesType.Descriptive)).toBe(true);
    expect(fitsType(1, SeriesType.Odd)).toBe(true);
    expect(fitsType(199, SeriesType.Odd)).toBe(true);
    expect(fitsType(2, SeriesType.Odd)).toBe(false);
    expect(fitsType(200, SeriesType.Odd)).toBe(false);
    expect(fitsType(2, SeriesType.Even)).toBe(true);
    expect(fitsType(200, SeriesType.Even)).toBe(true);
    expect(fitsType(1, SeriesType.Even)).toBe(false);
    expect(fitsType(199, SeriesType.Even)).toBe(false);
  });

  test("isInRange - all", () => {
    expect(isInRange(1, null, {})).toBe(true);
    expect(isInRange(2000, null, {})).toBe(true);
  });

  test("isInRange - from, number only", () => {
    const range = { from: { number: 5 } };
    expect(isInRange(5, null, range)).toBe(true);
    expect(isInRange(5, "a", range)).toBe(true);
    expect(isInRange(2000, null, range)).toBe(true);
    expect(isInRange(2000, "a", range)).toBe(true);
    expect(isInRange(4, null, range)).toBe(false);
  });

  test("isInRange - to, number only", () => {
    const range = { to: { number: 100 } };
    expect(isInRange(1, null, range)).toBe(true);
    expect(isInRange(1, "a", range)).toBe(true);
    expect(isInRange(100, null, range)).toBe(true);
    expect(isInRange(100, "a", range)).toBe(false);
    expect(isInRange(200, null, range)).toBe(false);
  });

  test("isInRange - to and from, number only", () => {
    const range = { from: { number: 100 }, to: { number: 200 } };
    expect(isInRange(100, null, range)).toBe(true);
    expect(isInRange(100, "a", range)).toBe(true);
    expect(isInRange(150, null, range)).toBe(true);
    expect(isInRange(150, "a", range)).toBe(true);
    expect(isInRange(200, null, range)).toBe(true);
    expect(isInRange(1, null, range)).toBe(false);
    expect(isInRange(200, "a", range)).toBe(false);
    expect(isInRange(201, null, range)).toBe(false);
    expect(isInRange(201, "a", range)).toBe(false);
    expect(isInRange(1000, null, range)).toBe(false);
  });

  test("isInRange - from, number and letter", () => {
    const range = { from: { number: 5, letter: "c" } };
    expect(isInRange(5, "c", range)).toBe(true);
    expect(isInRange(5, "z", range)).toBe(true);
    expect(isInRange(100, null, range)).toBe(true);
    expect(isInRange(200, null, range)).toBe(true);
    expect(isInRange(1, null, range)).toBe(false);
    expect(isInRange(1, "a", range)).toBe(false);
    expect(isInRange(5, null, range)).toBe(false);
    expect(isInRange(5, "b", range)).toBe(false);
  });

  test("isInRange - to, number and letter", () => {
    const range = { to: { number: 200, letter: "c" } };
    expect(isInRange(5, null, range)).toBe(true);
    expect(isInRange(5, "z", range)).toBe(true);
    expect(isInRange(200, null, range)).toBe(true);
    expect(isInRange(200, "a", range)).toBe(true);
    expect(isInRange(200, "c", range)).toBe(true);
    expect(isInRange(200, "d", range)).toBe(false);
    expect(isInRange(201, null, range)).toBe(false);
    expect(isInRange(201, "a", range)).toBe(false);
    expect(isInRange(1000, null, range)).toBe(false);
    expect(isInRange(1000, "a", range)).toBe(false);
  });

  test("isInRange - from and to, number and letter", () => {
    const range = {
      from: { number: 5, letter: "c" },
      to: { number: 200, letter: "c" },
    };
    expect(isInRange(5, "c", range)).toBe(true);
    expect(isInRange(5, "z", range)).toBe(true);
    expect(isInRange(100, null, range)).toBe(true);
    expect(isInRange(200, null, range)).toBe(true);
    expect(isInRange(200, "a", range)).toBe(true);
    expect(isInRange(200, "c", range)).toBe(true);
    expect(isInRange(1, null, range)).toBe(false);
    expect(isInRange(1, "b", range)).toBe(false);
    expect(isInRange(5, null, range)).toBe(false);
    expect(isInRange(5, "b", range)).toBe(false);
    expect(isInRange(200, "d", range)).toBe(false);
    expect(isInRange(201, null, range)).toBe(false);
    expect(isInRange(201, "a", range)).toBe(false);
    expect(isInRange(1000, null, range)).toBe(false);
    expect(isInRange(1000, "a", range)).toBe(false);
  });

  const testAddressPoints: AddressPoint[] = [
    {
      id: 82338752,
      address: "Lysá 686/20a, Želechovice nad Dřevnicí",
      street: "Lysá",
      city: "Želechovice nad Dřevnicí",
      descriptiveNumber: 686,
      orientationalNumber: 20,
      orientationalNumberLetter: "a",
      lat: 49.2148644630034,
      lng: 17.737142251143794,
      municipalityPart: "Dřevník",
      postalCode: "76311",
      type: 0,
    },
  ];

  test("equalsFullStreetNumber", () => {
    expect(
      equalsFullStreetNumber(
        {
          descriptiveNumber: { number: 686 },
          orientationalNumber: { number: 20, letter: "a" },
        },
        testAddressPoints[0]
      )
    ).toBe(true);

    expect(
      equalsFullStreetNumber(
        {
          descriptiveNumber: { number: 686 },
          orientationalNumber: { number: 20 },
        },
        testAddressPoints[0]
      )
    ).toBe(false);
  });

  test("find address points", () => {
    expect(
      findAddressPoints(
        {
          street: "Lysá",
          numberSpec: [],
        },
        testFounders[0]
      )
    ).toEqual(testAddressPoints);

    expect(
      findAddressPoints(
        {
          street: "Lysá",
          numberSpec: [
            {
              ranges: [],
              type: SeriesType.All,
            },
          ],
        },
        testFounders[0]
      )
    ).toEqual(testAddressPoints);

    expect(
      findAddressPoints(
        {
          street: "Lysá",
          numberSpec: [
            {
              ranges: [{ from: { number: 686 }, to: { number: 686 } }],
              type: SeriesType.Descriptive,
            },
          ],
        },
        testFounders[0]
      )
    ).toEqual(testAddressPoints);
  });
});
