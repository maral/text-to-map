import { describe, expect, test } from "@jest/globals";
import { splitStreetViaRomanNumerals } from "../../src/street-markdown/roman-numerals";

describe("smd extra parsing functions", () => {
  test("parse street name with roman numerals list", () => {
    expect(splitStreetViaRomanNumerals("Šrobárova")).toEqual(["Šrobárova"]);
    expect(splitStreetViaRomanNumerals("Šrobárova I, II")).toEqual([
      "Šrobárova I",
      "Šrobárova II",
    ]);
    expect(splitStreetViaRomanNumerals("Šrobárova X, XI, XII")).toEqual([
      "Šrobárova X",
      "Šrobárova XI",
      "Šrobárova XII",
    ]);

    expect(splitStreetViaRomanNumerals("Šrobárova X,XI,XII")).toEqual([
      "Šrobárova X",
      "Šrobárova XI",
      "Šrobárova XII",
    ]);

    expect(splitStreetViaRomanNumerals("V malých domech I, II, III")).toEqual([
      "V malých domech I",
      "V malých domech II",
      "V malých domech III",
    ]);
  });

  test("parse street name with roman numerals range", () => {
    const expected = [
      "Šrobárova I",
      "Šrobárova II",
      "Šrobárova III",
      "Šrobárova IV",
      "Šrobárova V",
      "Šrobárova VI",
      "Šrobárova VII",
      "Šrobárova VIII",
      "Šrobárova IX",
      "Šrobárova X",
    ];
    expect(splitStreetViaRomanNumerals("Šrobárova I-X")).toEqual(expected);
    expect(splitStreetViaRomanNumerals("Šrobárova I - X")).toEqual(expected);
    expect(splitStreetViaRomanNumerals("Jihozápadní I - VI")).toEqual([
      "Jihozápadní I",
      "Jihozápadní II",
      "Jihozápadní III",
      "Jihozápadní IV",
      "Jihozápadní V",
      "Jihozápadní VI",
    ]);
  });
});
