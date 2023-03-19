import { EmbeddedActionsParser, TokenVocabulary } from "chevrotain";
import { splitStreetViaRomanNumerals } from "./roman-numerals";

import {
  MainSeparator,
  Separator,
  OddType,
  EvenType,
  DescriptiveType,
  AllType,
  Number,
  Hyphen,
  StreetName,
  From,
  To,
  AndAbove,
  AndBelow,
  Slash,
  Without,
} from "./token-definition";
import { FullStreetNumber, RichNumber, SeriesType, SmdLine } from "./types";

export class SmdParser extends EmbeddedActionsParser {
  constructor(tokenVocabulary: TokenVocabulary) {
    super(tokenVocabulary);
    this.performSelfAnalysis();
  }

  public street = this.RULE("street", (): SmdLine[] => {
    let result;
    this.OR([
      {
        ALT: () => {
          result = this.SUBRULE(this.streetNameAndNumbersSpecs);
        },
      },
      {
        ALT: () => {
          result = { street: this.CONSUME(StreetName).image, numberSpec: [] };
        },
      },
    ]);

    return splitStreetViaRomanNumerals(result.street).map((street) => ({
      street,
      numberSpec: result.numberSpec,
    }));
  });

  private streetNameAndNumbersSpecs = this.RULE(
    "streetNameAndNumbersSpecs",
    () => {
      const street = this.CONSUME(StreetName).image;
      this.OPTION(() => {
        this.CONSUME(MainSeparator);
      });
      const numberSpec = this.SUBRULE(this.numberSpecs);
      return { street, numberSpec };
    }
  );

  private numberSpecs = this.RULE("numberSpecs", () => {
    const result = [];
    this.OR([
      {
        GATE: () => this.LA(2).tokenType === Without,
        ALT: () => {
          const type = this.SUBRULE(this.seriesType);
          this.CONSUME(Without);
          const ranges = this.SUBRULE(this.rangeList);
          return { negative: true, type, ranges };
        },
      },
      {
        ALT: () => {
          this.CONSUME2(Without);
          const type = this.SUBRULE2(this.seriesType);
          const ranges = this.SUBRULE2(this.rangeList);
          return { negative: true, type, ranges };
        },
      },
      {
        ALT: () => {
          this.AT_LEAST_ONE_SEP({
            SEP: Separator,
            DEF: () => {
              result.push(this.SUBRULE(this.seriesSpecs));
            },
          });
        },
      },
    ]);
    return result;
  });

  private seriesSpecs = this.RULE("seriesSpecs", () => {
    let ranges = [];
    let type: SeriesType;
    this.OR([
      {
        ALT: () => {
          type = this.SUBRULE(this.seriesType);
          this.OPTION(() => {
            ranges = this.SUBRULE(this.rangeList);
          });
        },
      },
      {
        ALT: () => {
          ({ type, ranges } = this.SUBRULE2(this.fromAndAboveWithType));
        },
      },
      {
        ALT: () => {
          ({ type, ranges } = this.SUBRULE(this.toOrBelowWithType));
        },
      },
    ]);

    return { type, ranges };
  });

  private rangeList = this.RULE("rangeList", () => {
    let ranges = [];
    ranges.push(this.SUBRULE(this.rangeOrNumber));
    this.MANY({
      GATE: () => [Number, To, From].includes(this.LA(2).tokenType),
      DEF: () => {
        this.CONSUME(Separator);
        ranges.push(this.SUBRULE2(this.rangeOrNumber));
      },
    });
    return ranges;
  });

  private seriesType = this.RULE("seriesType", () => {
    let type: SeriesType;
    this.OR([
      {
        ALT: () => {
          this.CONSUME(OddType);
          type = SeriesType.Odd;
        },
      },
      {
        ALT: () => {
          this.CONSUME1(EvenType);
          type = SeriesType.Even;
        },
      },
      {
        ALT: () => {
          this.CONSUME2(AllType);
          type = SeriesType.All;
        },
      },
      {
        ALT: () => {
          this.CONSUME3(DescriptiveType);
          type = SeriesType.Descriptive;
        },
      },
    ]);
    return type;
  });

  private rangeOrNumber = this.RULE("rangeOrNumber", () => {
    let result;
    this.OR([
      {
        ALT: () => {
          result = this.SUBRULE(this.range);
        },
      },
      {
        ALT: () => {
          result = this.SUBRULE(this.fromAndAbove);
        },
      },
      {
        ALT: () => {
          result = this.SUBRULE(this.toOrBelow);
        },
      },
      {
        ALT: () => {
          result = this.SUBRULE(this.fullStreetNumber);
        },
      },
      {
        ALT: () => {
          const n = parseRichNumber(this.CONSUME(Number).image);
          result = { from: n, to: n };
        },
      },
    ]);
    return result;
  });

  private range = this.RULE("range", () => {
    const from = parseRichNumber(this.CONSUME(Number).image);
    this.OR([
      { ALT: () => this.CONSUME1(Hyphen) },
      { ALT: () => this.CONSUME2(MainSeparator) },
    ]);
    const to = parseRichNumber(this.CONSUME3(Number).image);
    return { from, to };
  });

  private fromAndAbove = this.RULE("fromAndAbove", () => {
    let from: RichNumber;
    this.OR([
      {
        ALT: () => {
          from = parseRichNumber(this.CONSUME(Number).image);
          this.CONSUME(AndAbove);
        },
      },
      {
        ALT: () => {
          this.CONSUME(From);
          this.OPTION(() => {
            this.CONSUME(AllType);
          });
          from = parseRichNumber(this.CONSUME2(Number).image);
          this.OPTION2(() => {
            this.CONSUME2(AndAbove);
          });
        },
      },
    ]);

    return { from };
  });

  private fromAndAboveWithType = this.RULE("fromAndAboveWithType", () => {
    let type = SeriesType.All;
    this.CONSUME(From);
    this.OPTION(() => {
      this.OR([
        {
          ALT: () => {
            type = SeriesType.All;
            this.CONSUME(AllType);
          },
        },
        {
          ALT: () => {
            type = SeriesType.Descriptive;
            this.CONSUME(DescriptiveType);
          },
        },
      ]);
    });
    const from = parseRichNumber(this.CONSUME(Number).image);
    this.OPTION2(() => {
      this.CONSUME(AndAbove);
    });
    return { type, ranges: [{ from }] };
  });

  private toOrBelow = this.RULE("toOrBelow", () => {
    let to: RichNumber;
    this.OR([
      {
        ALT: () => {
          to = parseRichNumber(this.CONSUME(Number).image);
          this.CONSUME(AndBelow);
        },
      },
      {
        ALT: () => {
          this.CONSUME2(To);
          to = parseRichNumber(this.CONSUME2(Number).image);
        },
      },
    ]);

    return { to };
  });

  private toOrBelowWithType = this.RULE("toOrBelowWithType", () => {
    let type = SeriesType.All;
    this.CONSUME(To);
    this.OPTION(() => {
      this.OR([
        {
          ALT: () => {
            type = SeriesType.All;
            this.CONSUME(AllType);
          },
        },
        {
          ALT: () => {
            type = SeriesType.Descriptive;
            this.CONSUME(DescriptiveType);
          },
        },
      ]);
    });
    const to = parseRichNumber(this.CONSUME(Number).image);
    return { type, ranges: [{ to }] };
  });

  private fullStreetNumber = this.RULE(
    "fullStreetNumber",
    (): FullStreetNumber => {
      const descriptiveNumber = parseRichNumber(this.CONSUME(Number).image);
      this.CONSUME(Slash);
      const orientationNumber = parseRichNumber(this.CONSUME2(Number).image);
      return { descriptiveNumber, orientationalNumber: orientationNumber };
    }
  );
}

const numberWithCharacterPattern = /^(\d+)([a-z])$/;

export const parseRichNumber = (number: string): RichNumber => {
  if (numberWithCharacterPattern.test(number)) {
    const match = numberWithCharacterPattern.exec(number);
    return {
      number: parseInt(match[1]),
      letter: match[2],
    };
  } else {
    return {
      number: parseInt(number),
    };
  }
};
