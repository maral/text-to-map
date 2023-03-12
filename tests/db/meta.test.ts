import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { getMetaValue, setMetaValue } from "../../src/db/meta";
import { closeDb, setupDb } from "./db-setup";

const prefix = "meta";
beforeAll(() => {
  setupDb(prefix);
});

afterAll(() => {
  closeDb(prefix);
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
