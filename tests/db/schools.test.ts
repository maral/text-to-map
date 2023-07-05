import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import {
  closeDb,
  setupDb,
  testFounders,
  testRows,
  testSchools,
} from "./db-setup";
import { insertSchools } from "../../src/db/schools";
import { findFounder, insertFounders } from "../../src/db/founders";
import {
  commitAddressPoints,
  insertCities,
  insertDistricts,
  insertStreets,
} from "../../src/db/address-points";

const prefix = "schools";
beforeAll(async () => {
  await setupDb(prefix);
  await insertCities(testRows);
  await insertDistricts(testRows);
  await insertStreets(testRows);
  await commitAddressPoints(testRows);
});

afterAll(async () => {
  await closeDb(prefix);
});

describe("search db - schools", () => {
  test("insert schools", async () => {
    expect(await insertSchools(testSchools)).toBe(
      testSchools.length * 2 // each school will have only one location added
    );
  });

  test("insert founders", async () => {
    const totalSchools = testFounders.reduce(
      (total, founder) => total + founder.schools.length,
      0
    );
    expect(await insertFounders(testFounders)).toBe(
      testFounders.length + totalSchools
    );
  });

  test("find founder by founder name", async () => {
    const result = await findFounder("Město Želechovice nad Dřevnicí");
    expect(result.founder).toEqual(testFounders[0]);
    expect(result.errors).toHaveLength(0);
  });

  test("find founder by municipality name", async () => {
    const result = await findFounder("Želechovice nad Dřevnicí");
    expect(result.founder).toEqual(testFounders[0]);
    expect(result.errors).toHaveLength(0);
  });

  test("find founder by similar name", async () => {
    const result = await findFounder("Želehovice nad Dřevnicí");
    expect(result.founder).toEqual(testFounders[0]);
    expect(result.errors).toHaveLength(1);
  });

  test("find at least some founder even when very different name", async () => {
    const result = await findFounder("Město Ostrava");
    expect(result.founder).toEqual(testFounders[0]);
    expect(result.errors).toHaveLength(1);
  });
});
