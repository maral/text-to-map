const smdLexer = require("../step1_lexing/step1_lexing");
const CstParser = require("chevrotain").CstParser;
const tokenVocabulary = smdLexer.tokenVocabulary;

// individual imports, prefer ES6 imports if supported in your runtime/transpiler...
const MainSeparator = tokenVocabulary.MainSeparator;
const Separator = tokenVocabulary.Separator;
const OddType = tokenVocabulary.OddType;
const EvenType = tokenVocabulary.EvenType;
const AllType = tokenVocabulary.AllType;
const CPType = tokenVocabulary.CPType;
const Number = tokenVocabulary.Number;
const Comma = tokenVocabulary.Comma;
const NewLine = tokenVocabulary.NewLine;
const Hyphen = tokenVocabulary.Hyphen;
const Space = tokenVocabulary.Space;
const StreetName = tokenVocabulary.StreetName;

// ----------------- parser -----------------
class SmdParser extends CstParser {
  constructor() {
    super(tokenVocabulary);

    // for conciseness
    const $ = this;

    $.RULE("street", () => {
      $.OR([
        { ALT: () => $.SUBRULE($.streetNameAndNumbersSpecs) },
        { ALT: () => $.CONSUME(StreetName) },
      ]);
    });

    $.RULE("streetNameAndNumbersSpecs", () => {
      $.CONSUME(StreetName), $.CONSUME(MainSeparator), $.SUBRULE($.numberSpecs);
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
      $.SUBRULE($.seriesType),
        $.AT_LEAST_ONE_SEP({
          SEP: Separator,
          DEF: () => {
            $.SUBRULE($.rangeOrNumber);
          },
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
      $.CONSUME(Number), $.CONSUME1(Hyphen), $.CONSUME2(Number);
    });

    this.performSelfAnalysis();
  }
}

// We only ever need one as the parser internal state is reset for each new input.
const parserInstance = new SmdParser();

module.exports = {
  parserInstance: parserInstance,

  SmdParser: SmdParser,

  parse: function (inputText) {
    const lexResult = smdLexer.lex(inputText);

    // ".input" is a setter which will reset the parser's internal's state.
    parserInstance.input = lexResult.tokens;

    // No semantic actions so this won't return anything yet.
    parserInstance.street();

    if (parserInstance.errors.length > 0) {
      throw Error(
        "Sad sad panda, parsing errors detected!\n" +
          parserInstance.errors[0].message
      );
    }
  },
};
