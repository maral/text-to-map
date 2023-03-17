import { describe, expect, test } from "@jest/globals";
import { parseRichNumber } from "../../src/street-markdown/smd-parser";

describe("smd extra parsing functions", () => {
  test("parse number with/without a character", () => {
    expect(parseRichNumber("123")).toEqual({ number: 123 });
    expect(parseRichNumber("123a")).toEqual({
      number: 123,
      letter: "a",
    });
  });
});
