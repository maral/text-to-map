import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { parseLine } from "../../src/street-markdown/smd-line-parser";
import { SmdParser } from "../../src/street-markdown/smd-parser";
import { SeriesType } from "../../src/street-markdown/types";

beforeAll(() => {});

afterAll(() => {});

describe("parse line with street and number information", () => {
  test("SmdParser - parse number with/without a character", () => {
    expect(SmdParser.parseRichNumber("123")).toEqual({ number: 123 });
    expect(SmdParser.parseRichNumber("123a")).toEqual({
      number: 123,
      character: "a",
    });
  });

  test("street without number spec", () => {
    expect(parseLine("Šrobárova")).toEqual({
      street: "Šrobárova",
    });
  });

  test("street with simple range", () => {
    expect(parseLine("Šrobárova - č. 19-25")).toEqual({
      street: "Šrobárova",
      numberSpec: [
        {
          type: SeriesType.All,
          ranges: [{ from: { number: 19 }, to: { number: 25 } }],
        },
      ],
    });
  });

  test("street with single numbers and character", () => {
    expect(parseLine("Šrobárova - č. 19, 25, 36a")).toEqual({
      street: "Šrobárova",
      numberSpec: [
        {
          type: SeriesType.All,
          ranges: [
            { from: { number: 19 }, to: { number: 19 } },
            { from: { number: 25 }, to: { number: 25 } },
            {
              from: { number: 36, character: "a" },
              to: { number: 36, character: "a" },
            },
          ],
        },
      ],
    });
  });

  test("street with odd, even and descriptive numbers", () => {
    expect(
      parseLine("Šrobárova - lichá č. 19-27, sudá č. 10-22, č.p. 326, 255-258")
    ).toEqual({
      street: "Šrobárova",
      numberSpec: [
        {
          type: SeriesType.Odd,
          ranges: [{ from: { number: 19 }, to: { number: 27 } }],
        },
        {
          type: SeriesType.Even,
          ranges: [{ from: { number: 10 }, to: { number: 22 } }],
        },

        {
          type: SeriesType.Descriptive,
          ranges: [
            { from: { number: 326 }, to: { number: 326 } },
            { from: { number: 255 }, to: { number: 258 } },
          ],
        },
      ],
    });
  });
});
