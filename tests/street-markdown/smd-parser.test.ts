import { describe, expect, test } from "@jest/globals";
import {
  parseMunicipalityPartName,
  parseRichNumber,
} from "../../src/street-markdown/smd-parser";

describe("smd extra parsing functions", () => {
  test("parse number with/without a character", () => {
    expect(parseRichNumber("123")).toEqual({ number: 123 });
    expect(parseRichNumber("123a")).toEqual({
      number: 123,
      letter: "a",
    });
  });

  test("parse municipality part name", () => {
    expect(parseMunicipalityPartName("část obce Březenec")).toEqual("Březenec");
    expect(parseMunicipalityPartName("část města Březenec")).toEqual(
      "Březenec"
    );
  });
});
