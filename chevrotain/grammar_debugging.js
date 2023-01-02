const chevrotain = require("chevrotain");

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
const SmdLexer = new Lexer(smdTokens, { positionTracking: "onlyStart" });

class SmdParser extends chevrotain.CstParser {
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
      $.CONSUME(B);
      $.MANY({
        GATE: () => $.LA(2).tokenType === B,
        DEF: () => {
          $.CONSUME(X);
          $.CONSUME2(B);
        },
      });
    });

    this.performSelfAnalysis();
  }
}

const inputText = "print 3 + 4 + 5 + print 2 + 3";
const lexingResult = SmdLexer.tokenize(inputText);

if (lexingResult.errors.length > 0) {
  console.log(JSON.stringify(lexingResult.errors));
  throw Error("Sad Sad Panda, lexing errors detected");
}

const tokens = lexingResult.tokens.map(
  (token) => "'" + token.image + "' (" + token.tokenType.name + ")"
);
console.log(tokens);

const parserInstance = new SmdParser([], { outputCst: true });
parserInstance.input = lexingResult.tokens;
const output = parserInstance.main();

if (parserInstance.errors.length > 0) {
  console.log(parserInstance.errors);
} else {
  console.log(output);
}
