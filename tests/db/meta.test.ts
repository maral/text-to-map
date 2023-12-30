import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getMetaValue, setMetaValue } from "../../src/db/meta";
import { closeDb, setupDb } from "./db-setup";

const prefix = "meta";
beforeAll(async () => {
  await setupDb(prefix);
});

afterAll(async () => {
  await closeDb(prefix);
});

describe("search db - meta table", () => {
  test("get a non-existent meta value", async () => {
    expect(await getMetaValue("non-existent")).toBeUndefined();
  });

  test("set and read a meta value", async () => {
    await setMetaValue("testKey", 1);
    expect(Number(await getMetaValue("testKey"))).toBe(1);
  });

  test("set, read, rewrite and read again a meta value", async () => {
    await setMetaValue("anotherKey", "abc");
    expect(await getMetaValue("anotherKey")).toBe("abc");
    await setMetaValue("anotherKey", "def");
    expect(await getMetaValue("anotherKey")).toBe("def");
  });
});
