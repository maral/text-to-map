(function jsonGrammarOnlyExample() {
  // ----------------- Lexer -----------------
  const createToken = chevrotain.createToken;
  const Lexer = chevrotain.Lexer;

  const MainSeparator = createToken({ name: "MainSeparator", pattern: / - / });
  const Separator = createToken({ name: "Separator", pattern: /,| a / });
  const StreetName = createToken({
    name: "StreetName",
    pattern: /[^ -]+([ -]?[^ -]+)*/,
  });
  const OddType = createToken({ name: "OddType", pattern: /lichá č./ });
  const EvenType = createToken({ name: "EvenType", pattern: /sudá č./ });
  const CPType = createToken({ name: "CPType", pattern: /č. p./ });
  const AllType = createToken({
    name: "AllType",
    pattern: /č./,
    longer_alt: CPType,
  });
  const Number = createToken({ name: "Number", pattern: /\d+[a-zA-Z]?/ });
  const NewLine = createToken({ name: "NewLine", pattern: /\n/ });
  const Hyphen = createToken({ name: "Hyphen", pattern: /\-/ });
  const Space = createToken({
    name: "Space",
    pattern: / +/,
    longer_alt: [MainSeparator, Separator],
    group: Lexer.SKIPPED,
  });

  const smdTokens = [
    MainSeparator,
    Separator,
    OddType,
    EvenType,
    CPType,
    AllType,
    Number,
    NewLine,
    Hyphen,
    Space,
    StreetName,
  ];

  const SmdLexer = new Lexer(smdTokens, {
    // Less position info tracked, reduces verbosity of the playground output.
    positionTracking: "onlyStart",
  });

  MainSeparator.LABEL = "' - '";
  Separator.LABEL = "','";
  Hyphen.LABEL = "'-'";
  NewLine.LABEL = "'\\n'";
  Space.LABEL = "' '";
  OddType.LABEL = "'lichá č.'";
  EvenType.LABEL = "'sudá č.'";
  CPType.LABEL = "'č. p.'";
  AllType.LABEL = "'č.'";

  const tokenVocabulary = {};

  smdTokens.forEach((tokenType) => {
    tokenVocabulary[tokenType.name] = tokenType;
  });

  const CstParser = chevrotain.CstParser;

  class SmdParser extends CstParser {
    constructor() {
      super(tokenVocabulary);

      const $ = this;

      $.RULE("school", () => {
        $.AT_LEAST_ONE_SEP({
          SEP: NewLine,
          DEF: () => {
            $.SUBRULE($.street);
          },
        });
      });

      $.RULE("street", () => {
        $.OR([
          { ALT: () => $.SUBRULE($.streetNameAndNumbersSpecs) },
          { ALT: () => $.CONSUME(StreetName) },
        ]);
      });

      $.RULE("streetNameAndNumbersSpecs", () => {
        $.CONSUME(StreetName);
        $.CONSUME(MainSeparator);
        $.SUBRULE($.numberSpecs);
      });

      $.RULE("numberSpecs", () => {
        $.AT_LEAST_ONE_SEP({
          SEP: Separator,
          DEF: () => {
            $.SUBRULE($.seriesSpecs);
          },
        });
      });

      $.RULE("seriesSpecs", () => {
        $.SUBRULE($.seriesType);
        $.OPTION(() => {
          $.SUBRULE($.rangeOrNumber);
          $.MANY({
            GATE: () => $.LA(2).tokenType === Number,
            DEF: () => {
              $.CONSUME(Separator);
              $.SUBRULE2($.rangeOrNumber);
            },
          });
        });
      });

      $.RULE("seriesType", () => {
        $.OR([
          { ALT: () => $.CONSUME(OddType) },
          { ALT: () => $.CONSUME1(EvenType) },
          { ALT: () => $.CONSUME2(AllType) },
          { ALT: () => $.CONSUME3(CPType) },
        ]);
      });

      $.RULE("rangeOrNumber", () => {
        $.OR([
          { ALT: () => $.SUBRULE($.range) },
          { ALT: () => $.CONSUME(Number) },
        ]);
      });

      $.RULE("range", () => {
        $.CONSUME(Number);
        $.CONSUME1(Hyphen);
        $.CONSUME2(Number);
      });

      this.performSelfAnalysis();
    }
  }

  // for the playground to work the returned object must contain these fields
  return {
    lexer: SmdLexer,
    parser: SmdParser,
    defaultRule: "school",
  };
})();
