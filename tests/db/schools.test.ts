import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import {
  closeDb,
  setupDb,
  testFounders,
  testRows,
  testSchools,
} from "./db-setup";
import {
  insertSchools,
  insertFounders,
  findFounder,
} from "../../src/db/schools";
import {
  commitAddressPoints,
  importParsedLine,
  insertCities,
  insertDistricts,
  insertStreets,
} from "../../src/db/address-points";

const prefix = "schools";
beforeAll(() => {
  setupDb(prefix);
  insertCities(testRows);
  insertDistricts(testRows);
  insertStreets(testRows);
  testRows.forEach(importParsedLine);
  commitAddressPoints();
});

afterAll(() => {
  closeDb(prefix);
});

describe("search db - schools", () => {
  test("insert schools", () => {
    expect(insertSchools(testSchools)).toBe(
      testSchools.length * 2 // each school will have only one location added
    );
  });

  test("insert founders", () => {
    const totalSchools = testFounders.reduce(
      (total, founder) => total + founder.schools.length,
      0
    );
    expect(insertFounders(testFounders)).toBe(
      testFounders.length + totalSchools
    );
  });

  test("find founder by founder name", () => {
    const result = findFounder("Město Želechovice nad Dřevnicí");
    expect(result.founder).toEqual(testFounders[0]);
    expect(result.errors).toHaveLength(0);
  });

  test("find founder by municipality name", () => {
    const result = findFounder("Želechovice nad Dřevnicí");
    expect(result.founder).toEqual(testFounders[0]);
    expect(result.errors).toHaveLength(0);
  });

  test("find founder by similar name", () => {
    const result = findFounder("Želehovice nad Dřevnicí");
    expect(result.founder).toEqual(testFounders[0]);
    expect(result.errors).toHaveLength(1);
  });

  test("find at least some founder even when very different name", () => {
    const result = findFounder("Město Ostrava");
    expect(result.founder).toEqual(testFounders[0]);
    expect(result.errors).toHaveLength(1);
  });
});
