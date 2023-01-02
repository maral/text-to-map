(function jsonGrammarOnlyExample() {
  // ----------------- Lexer -----------------
  const createToken = chevrotain.createToken;
  const Lexer = chevrotain.Lexer;
  const EMPTY_ALT = chevrotain.EMPTY_ALT;

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
        $.CONSUME(A);
        $.MANY({
          DEF: () => {
            $.SUBRULE($.r2);
          },
        });
      });

      $.RULE("r2", () => {
        $.OR([{ ALT: () => $.SUBRULE($.r3) }, { ALT: () => $.SUBRULE($.r5) }]);
      });

      $.RULE("r3", () => {
        $.AT_LEAST_ONE_SEP({
          SEP: X,
          DEF: () => {
            $.CONSUME2(B);
          },
        });
        $.OPTION(() => {
          $.CONSUME(X);
          $.CONSUME(A);
        });
      });

      $.RULE("r5", () => {
        $.CONSUME(X);
        $.CONSUME(A);
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
