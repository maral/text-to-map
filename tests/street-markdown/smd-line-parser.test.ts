import { describe, expect, test } from "@jest/globals";
import { parseLine } from "../../src/street-markdown/smd-line-parser";
import {
  FullStreetNumber,
  ProcessedSmdLines,
  RangeSpec,
  SeriesType,
  SmdLine,
} from "../../src/street-markdown/types";

const transform = (smdLine: SmdLine): ProcessedSmdLines => {
  return { smdLines: [smdLine], errors: [] };
};

const transformMulti = (smdLines: SmdLine[]): ProcessedSmdLines => {
  return { smdLines: smdLines, errors: [] };
};

const streetOnly = (street: string): ProcessedSmdLines => {
  return transform({ type: "street", street, numberSpec: [] });
};

const streetOnlyNoTransform = (street: string): SmdLine => {
  return { type: "street", street, numberSpec: [] };
};

const simpleExampleWithType = (type: SeriesType): ProcessedSmdLines => {
  return exampleWithTypeAndRanges(type, [
    { from: { number: 19 }, to: { number: 25 } },
  ]);
};

const exampleWithTypeAndRanges = (
  type: SeriesType,
  ranges: (RangeSpec | FullStreetNumber)[]
): ProcessedSmdLines => {
  return transform({
    type: "street",
    street: "Šrobárova",
    numberSpec: [
      {
        type: type,
        ranges: ranges,
      },
    ],
  });
};

describe("parse line with street and number information", () => {
  test("street without number spec", () => {
    expect(parseLine("Šrobárova")).toEqual(
      transform({
        type: "street",
        street: "Šrobárova",
        numberSpec: [],
      })
    );
  });

  test("street with simple range", () => {
    expect(parseLine("Šrobárova - č. 19-25")).toEqual(
      transform({
        type: "street",
        street: "Šrobárova",
        numberSpec: [
          {
            type: SeriesType.All,
            ranges: [{ from: { number: 19 }, to: { number: 25 } }],
          },
        ],
      })
    );
  });

  test("street with different variants - orientational numbers", () => {
    expect(parseLine("Šrobárova - č. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.All)
    );
    expect(parseLine("Šrobárova - č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.All)
    );
    expect(parseLine("Šrobárova č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.All)
    );
    expect(parseLine("Šrobárova - pouze č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.All)
    );
  });

  test("street with different variants - odd numbers", () => {
    expect(parseLine("Šrobárova - lichá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova lichá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova - lichá č.o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova - č. lichá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova č. lichá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova - č. o. lichá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova č. o. lichá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova - č.o. lichá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova - lichá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova lichá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova - pouze lichá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova pouze lichá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova - všechna lichá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
    expect(parseLine("Šrobárova všechna lichá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Odd)
    );
  });

  test("street with different variants - even numbers", () => {
    expect(parseLine("Šrobárova - sudá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova sudá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova - sudá č.o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova - č. sudá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova č. sudá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova - č. o. sudá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova č. o. sudá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova - č.o. sudá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova - sudá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova sudá 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova - pouze sudá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova pouze sudá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova - všechna sudá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
    expect(parseLine("Šrobárova všechna sudá č. o. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Even)
    );
  });

  test("street with different variants - descriptive numbers", () => {
    expect(parseLine("Šrobárova - č. p. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Description)
    );
    expect(parseLine("Šrobárova č. p. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Description)
    );
    expect(parseLine("Šrobárova - pouze č. p. 19-25")).toEqual(
      simpleExampleWithType(SeriesType.Description)
    );
  });

  test("street with single numbers and character", () => {
    expect(parseLine("Šrobárova - č. 19, 25, 36a")).toEqual(
      transform({
        type: "street",
        street: "Šrobárova",
        numberSpec: [
          {
            type: SeriesType.All,
            ranges: [
              { from: { number: 19 }, to: { number: 19 } },
              { from: { number: 25 }, to: { number: 25 } },
              {
                from: { number: 36, letter: "a" },
                to: { number: 36, letter: "a" },
              },
            ],
          },
        ],
      })
    );
  });

  test("street with odd, even and descriptive numbers", () => {
    expect(
      parseLine("Šrobárova - lichá č. 19-27, sudá č. 10-22, č.p. 326, 255-258")
    ).toEqual(
      transform({
        type: "street",
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
            type: SeriesType.Description,
            ranges: [
              { from: { number: 326 }, to: { number: 326 } },
              { from: { number: 255 }, to: { number: 258 } },
            ],
          },
        ],
      })
    );
  });

  test("street with range x and above", () => {
    const ranges = [{ from: { number: 19 } }];
    const expectedAll = exampleWithTypeAndRanges(SeriesType.All, ranges);
    const expectedOdd = exampleWithTypeAndRanges(SeriesType.Odd, ranges);
    const expectedEven = exampleWithTypeAndRanges(SeriesType.Even, ranges);
    const expectedDescriptive = exampleWithTypeAndRanges(
      SeriesType.Description,
      ranges
    );

    expect(parseLine("Šrobárova - od č. 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova od č. 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - od 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova od 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - od č. 19 výše")).toEqual(expectedAll);
    expect(parseLine("Šrobárova od č. 19 výše")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - č. od 19 výše")).toEqual(expectedAll);
    expect(parseLine("Šrobárova č. od 19 výše")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - č. od 19 a výše")).toEqual(expectedAll);
    expect(parseLine("Šrobárova č. od 19 a výše")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - č. 19 a výše")).toEqual(expectedAll);
    expect(parseLine("Šrobárova č. 19 a výše")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - od č. 19 vyšší")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - od č. 19 a vyšší")).toEqual(expectedAll);

    expect(parseLine("Šrobárova - lichá č. od 19")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - lichá č. od 19 výše")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - lichá č. o. od 19 výše")).toEqual(
      expectedOdd
    );
    expect(parseLine("Šrobárova - lichá od č. 19")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - lichá od č. o. 19")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - lichá od č. 19 výše")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - lichá od č. o. 19 výše")).toEqual(
      expectedOdd
    );

    expect(parseLine("Šrobárova - sudá č. od 19")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - sudá č. od 19 výše")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - sudá č. o. od 19 výše")).toEqual(
      expectedEven
    );
    expect(parseLine("Šrobárova - sudá od č. 19")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - sudá od č. o. 19")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - sudá od č. 19 výše")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - sudá od č. o. 19 výše")).toEqual(
      expectedEven
    );

    expect(parseLine("Šrobárova - č. p. od 19")).toEqual(expectedDescriptive);
    expect(parseLine("Šrobárova - č. p. od 19 výše")).toEqual(
      expectedDescriptive
    );
    expect(parseLine("Šrobárova - č. p. od č. 19")).toEqual(
      expectedDescriptive
    );
    expect(parseLine("Šrobárova - č. p. od č. 19 výše")).toEqual(
      expectedDescriptive
    );
  });

  test("street with possible interruption prefix", () => {
    expect(parseLine("Národního odboje")).toEqual(
      streetOnly("Národního odboje")
    );
  });

  test("street with range x and below", () => {
    const ranges = [{ to: { number: 19 } }];
    const expectedAll = exampleWithTypeAndRanges(SeriesType.All, ranges);
    const expectedOdd = exampleWithTypeAndRanges(SeriesType.Odd, ranges);
    const expectedEven = exampleWithTypeAndRanges(SeriesType.Even, ranges);
    const expectedDescriptive = exampleWithTypeAndRanges(
      SeriesType.Description,
      ranges
    );

    expect(parseLine("Šrobárova - č. 19 a níže")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - č. 19 a níž")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - č. 19 a nižší")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - lichá č. 19 a nižší")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - lichá č. o. 19 a nižší")).toEqual(
      expectedOdd
    );
    expect(parseLine("Šrobárova - lichá 19 a nižší")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - sudá č. 19 a nižší")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - sudá č. o. 19 a nižší")).toEqual(
      expectedEven
    );
    expect(parseLine("Šrobárova - sudá 19 a nižší")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - č. p. 19 a nižší")).toEqual(
      expectedDescriptive
    );
  });

  test("street with range up to x", () => {
    const ranges = [{ to: { number: 19 } }];
    const expectedAll = exampleWithTypeAndRanges(SeriesType.All, ranges);
    const expectedOdd = exampleWithTypeAndRanges(SeriesType.Odd, ranges);
    const expectedEven = exampleWithTypeAndRanges(SeriesType.Even, ranges);
    const expectedDescriptive = exampleWithTypeAndRanges(
      SeriesType.Description,
      ranges
    );
    expect(parseLine("Šrobárova - č. do 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova č. do 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - č. o. do 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova č. o. do 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - lichá č. do 19")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - lichá č. o. do 19")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova lichá č. do 19")).toEqual(expectedOdd);
    expect(parseLine("Šrobárova - sudá č. do 19")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - sudá č. o. do 19")).toEqual(expectedEven);
    expect(parseLine("Šrobárova sudá č. do 19")).toEqual(expectedEven);
    expect(parseLine("Šrobárova - č. p. do 19")).toEqual(expectedDescriptive);

    expect(parseLine("Šrobárova - do č. 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova do č. 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova - do 19")).toEqual(expectedAll);
    expect(parseLine("Šrobárova do 19")).toEqual(expectedAll);

    expect(parseLine("Šrobárova - do č. p. 19")).toEqual(expectedDescriptive);
    expect(parseLine("Šrobárova do č. p. 19")).toEqual(expectedDescriptive);
  });

  test("street with full street numbers", () => {
    const expected = transform({
      type: "street",
      street: "Šrobárova",
      numberSpec: [
        {
          type: SeriesType.All,
          ranges: [
            {
              descriptionNumber: { number: 325 },
              orientationalNumber: { number: 12, letter: "a" },
            },
          ],
        },
      ],
    });

    expect(parseLine("Šrobárova - č. 325/12a")).toEqual(expected);
    expect(parseLine("Šrobárova č. 325/12a")).toEqual(expected);
  });

  test("multiple street with roman numerals", () => {
    const expected = transform({
      type: "street",
      street: "Šrobárova",
      numberSpec: [
        {
          type: SeriesType.All,
          ranges: [
            {
              descriptionNumber: { number: 325 },
              orientationalNumber: { number: 12, letter: "a" },
            },
          ],
        },
      ],
    });

    expect(parseLine("Šrobárova - č. 325/12a")).toEqual(expected);
    expect(parseLine("Šrobárova č. 325/12a")).toEqual(expected);
  });

  test("weird street names", () => {
    [
      "Šrobárova",
      "8. listopadu",
      "28. pluku",
      "Zelenky-Hajského",
      "Ke Koh-i-nooru",
    ].forEach((street: string) => {
      expect(parseLine(street)).toEqual(streetOnly(street));
    });
  });

  test("roman numerals", () => {
    expect(parseLine("Jihozápadní I, II, III")).toEqual(
      transformMulti(
        ["Jihozápadní I", "Jihozápadní II", "Jihozápadní III"].map(
          streetOnlyNoTransform
        )
      )
    );

    expect(parseLine("Jihozápadní I - III")).toEqual(
      transformMulti(
        ["Jihozápadní I", "Jihozápadní II", "Jihozápadní III"].map(
          streetOnlyNoTransform
        )
      )
    );
  });

  test("municipality part", () => {
    expect(parseLine("část obce Huntířov")).toEqual(
      transform({
        type: "municipalityPart",
        municipalityPart: "Huntířov",
        numberSpec: [],
      })
    );
  });

  test("municipality part with number specs", () => {
    expect(parseLine("část obce Huntířov - č.p. 19-25")).toEqual(
      transform({
        type: "municipalityPart",
        municipalityPart: "Huntířov",
        numberSpec: [
          {
            type: SeriesType.Description,
            ranges: [{ from: { number: 19 }, to: { number: 25 } }],
          },
        ],
      })
    );

    const result = parseLine("část města Dolní Libchava - mimo č. p. 19");

    expect(result).toEqual(
      transform({
        type: "municipalityPart",
        municipalityPart: "Dolní Libchava",
        numberSpec: {
          negative: true,
          type: SeriesType.Description,
          ranges: [{ from: { number: 19 }, to: { number: 19 } }],
        },
      })
    );
  });
});
