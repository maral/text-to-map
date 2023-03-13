import { EmbeddedActionsParser, TokenVocabulary } from "chevrotain";

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
  AndAbove,
} from "./token-definition";
import { RichNumber, SeriesType, SmdLine } from "./types";

export class SmdParser extends EmbeddedActionsParser {
  constructor(tokenVocabulary: TokenVocabulary) {
    super(tokenVocabulary);
    this.performSelfAnalysis();
  }

  static readonly numberWithCharacterPattern = /^(\d+)([a-z])$/;

  public static parseRichNumber(number: string): RichNumber {
    if (this.numberWithCharacterPattern.test(number)) {
      const match = this.numberWithCharacterPattern.exec(number);
      return {
        number: parseInt(match[1]),
        letter: match[2],
      };
    } else {
      return {
        number: parseInt(number),
      };
    }
  }

  public street = this.RULE("street", (): SmdLine => {
    let result;
    this.OR([
      {
        ALT: () => {
          result = this.SUBRULE(this.streetNameAndNumbersSpecs);
        },
      },
      {
        ALT: () => {
          result = { street: this.CONSUME(StreetName).image };
        },
      },
    ]);
    return result;
  });

  private streetNameAndNumbersSpecs = this.RULE(
    "streetNameAndNumbersSpecs",
    () => {
      const street = this.CONSUME(StreetName).image;
      this.CONSUME(MainSeparator);
      const numberSpec = this.SUBRULE(this.numberSpecs);
      return { street, numberSpec };
    }
  );

  private numberSpecs = this.RULE("numberSpecs", () => {
    const result = [];
    this.AT_LEAST_ONE_SEP({
      SEP: Separator,
      DEF: () => {
        result.push(this.SUBRULE(this.seriesSpecs));
      },
    });
    return result;
  });

  private seriesSpecs = this.RULE("seriesSpecs", () => {
    const type = this.SUBRULE(this.seriesType);
    const ranges = [];
    this.OPTION(() => {
      ranges.push(this.SUBRULE(this.rangeOrNumber));
      this.MANY({
        GATE: () => this.LA(2).tokenType === Number,
        DEF: () => {
          this.CONSUME(Separator);
          ranges.push(this.SUBRULE2(this.rangeOrNumber));
        },
      });
    });

    return { type, ranges };
  });

  private seriesType = this.RULE("seriesType", () => {
    let type;
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
          const n = SmdParser.parseRichNumber(this.CONSUME(Number).image);
          result = { from: n, to: n };
        },
      },
    ]);
    return result;
  });

  private range = this.RULE("range", () => {
    const from = SmdParser.parseRichNumber(this.CONSUME(Number).image);
    this.OR([
      { ALT: () => this.CONSUME1(Hyphen) },
      { ALT: () => this.CONSUME2(MainSeparator) },
    ]);
    const to = SmdParser.parseRichNumber(this.CONSUME3(Number).image);
    return { from, to };
  });

  private fromAndAbove = this.RULE("fromAndAbove", () => {
    let from: RichNumber;
    this.OR([
      {
        ALT: () => {
          this.OPTION(() => {
            this.CONSUME(From);
          });
          from = SmdParser.parseRichNumber(this.CONSUME(Number).image);
          this.CONSUME(AndAbove);
        },
      },
      {
        ALT: () => {
          this.CONSUME2(From);
          from = SmdParser.parseRichNumber(this.CONSUME2(Number).image);
        },
      },
    ]);

    return { from };
  });
}
