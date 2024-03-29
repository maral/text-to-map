import { EmbeddedActionsParser, EOF, TokenVocabulary } from "chevrotain";
import { splitStreetViaRomanNumerals } from "./roman-numerals";

import {
  AllType,
  AndAbove,
  AndBelow,
  DescriptiveType,
  EvenType,
  From,
  Hyphen,
  MainSeparator,
  MunicipalityPartName,
  Number,
  OddType,
  Separator,
  Slash,
  StreetName,
  To,
  Without,
} from "./token-definition";
import { FullStreetNumber, NegativeSeriesSpec, RichNumber, SeriesType, SmdLine } from "./types";

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
          result = {
            type: "street",
            street: this.CONSUME(StreetName).image,
            numberSpec: [],
          } as SmdLine;
        },
      },
      {
        ALT: () => {
          result = this.SUBRULE(this.municipalityPartNameAndNumbersSpecs);
        },
      },
      {
        ALT: () => {
          const municipalityPart = parseMunicipalityPartName(
            this.CONSUME(MunicipalityPartName).image
          );
          result = {
            type: "municipalityPart",
            municipalityPart,
            numberSpec: [],
          } as SmdLine;
        },
      },
    ]);

    if (result.type === "street") {
      return splitStreetViaRomanNumerals(result.street).map((street) => ({
        type: "street",
        street,
        numberSpec: result.numberSpec,
      }));
    } else {
      return [result];
    }
  });

  private streetNameAndNumbersSpecs = this.RULE(
    "streetNameAndNumbersSpecs",
    () => {
      const street = this.CONSUME(StreetName).image;
      this.OPTION(() => {
        this.CONSUME(MainSeparator);
      });
      const numberSpec = this.SUBRULE(this.numberSpecs);
      return { type: "street", street, numberSpec } as SmdLine;
    }
  );

  private municipalityPartNameAndNumbersSpecs = this.RULE(
    "municipalityPartNameAndNumbersSpecs",
    () => {
      const municipalityPart = parseMunicipalityPartName(
        this.CONSUME(MunicipalityPartName).image
      );
      this.OPTION(() => {
        this.CONSUME(MainSeparator);
      });
      const numberSpec = this.SUBRULE(this.numberSpecs);
      return {
        type: "municipalityPart",
        municipalityPart,
        numberSpec,
      } as SmdLine;
    }
  );

  private numberSpecs = this.RULE("numberSpecs", () => {
    const positiveResult = [];
    let negativeResult: NegativeSeriesSpec;
    this.OR([
      {
        GATE: () => this.LA(2).tokenType === Without,
        ALT: () => {
          const type = this.SUBRULE(this.seriesType);
          this.CONSUME(Without);
          this.OPTION(() => {
            this.CONSUME(AllType);
          });
          const ranges = this.SUBRULE(this.rangeList);
          return { negative: true, type, ranges };
        },
      },
      {
        ALT: () => {
          this.CONSUME2(Without);
          this.OR1([
            {
              GATE: this._gatePostfixTypeSeriesSpec,
              ALT: () => {
                const { type, ranges } = this.SUBRULE(
                  this.postfixTypeSeriesSpec
                );
                negativeResult = { negative: true, type, ranges };
              },
            },
            {
              ALT: () => {
                const type = this.SUBRULE2(this.seriesType);
                const ranges = this.SUBRULE2(this.rangeList);
                negativeResult = { negative: true, type, ranges };
              },
            },
          ]);
        },
      },
      {
        ALT: () => {
          this.AT_LEAST_ONE_SEP({
            SEP: Separator,
            DEF: () => {
              positiveResult.push(this.SUBRULE(this.seriesSpecs));
            },
          });
        },
      },
    ]);
    if (negativeResult) {
      return negativeResult;
    }
    return positiveResult;
  });

  private seriesSpecs = this.RULE("seriesSpecs", () => {
    let ranges = [];
    let type: SeriesType;
    this.OR([
      {
        GATE: this._gatePostfixTypeSeriesSpec,
        ALT: () => {
          ({ type, ranges } = this.SUBRULE(this.postfixTypeSeriesSpec));
        },
      },
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

  private _gatePostfixTypeSeriesSpec = (): boolean => {
    let index = 2;
    while (![Separator, EOF].includes(this.LA(index).tokenType)) {
      if ([OddType, EvenType].includes(this.LA(index).tokenType)) {
        return true;
      }
      index++;
    }
    return false;
  };

  private postfixTypeSeriesSpec = this.RULE("postfixTypeSeriesSpec", () => {
    this.CONSUME(AllType);
    const ranges = [this.SUBRULE(this.rangeOrNumber)];
    let type: SeriesType;
    this.OR1([
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
          type = SeriesType.Description;
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
    this.OPTION(() => {
      this.CONSUME(AllType);
    });
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
            type = SeriesType.Description;
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
            type = SeriesType.Description;
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
      return {
        descriptionNumber: descriptiveNumber,
        orientationalNumber: orientationNumber,
      };
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

const municipalityPartPattern = /^část (?<type>obce|města) (?<name>.+)$/;

export const parseMunicipalityPartName = (name: string): string => {
  const match = municipalityPartPattern.exec(name);
  return match?.groups.name?.trim() ?? "";
};
