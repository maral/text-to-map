(function jsonGrammarOnlyExample() {
  // ----------------- Lexer -----------------
  const createToken = chevrotain.createToken;
  const Lexer = chevrotain.Lexer;

  const A = createToken({ name: "print", pattern: /print/ });
  const B = createToken({ name: "Number", pattern: /\d+/ });
  const X = createToken({
    name: "Separator",
    pattern: /,/,
  });
  const Space = createToken({
    name: "Space",
    pattern: / +/,
    group: Lexer.SKIPPED,
  });

  X.LABEL = "','";

  const smdTokens = [A, B, X, Space];

  const JsonLexer = new Lexer(smdTokens, {
    // Less position info tracked, reduces verbosity of the playground output.
    positionTracking: "onlyStart",
  });

  // ----------------- parser -----------------
  const CstParser = chevrotain.CstParser;

  class JsonParser extends CstParser {
    constructor() {
      super(smdTokens);

      const $ = this;

      $.RULE("r1", () => {
        $.AT_LEAST_ONE_SEP({
          SEP: X,
          DEF: () => {
            $.SUBRULE($.r2);
          },
        });
      });

      $.RULE("r2", () => {
        $.CONSUME(A);
        $.MANY_SEP({
          SEP: X,
          DEF: () => {
            $.CONSUME(B);
          },
        });
      });

      this.performSelfAnalysis();
    }
  }

  // for the playground to work the returned object must contain these fields
  return {
    lexer: JsonLexer,
    parser: JsonParser,
    defaultRule: "r1",
  };
})();
