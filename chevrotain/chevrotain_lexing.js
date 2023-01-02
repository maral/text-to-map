import { CstParser } from "chevrotain";
// const token_definition = require("token_definition");

import {
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
  SmdLexer,
  tokenVocabulary,
} from "./token_definition.mjs";

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
      $.OR([
        { ALT: () => $.CONSUME1(Hyphen) },
        { ALT: () => $.CONSUME2(MainSeparator) },
      ]);
      $.CONSUME3(Number);
    });

    this.performSelfAnalysis();
  }
}

const inputText = `Čestlická 
Dubečská - č. 1 – 9  
Gutova 
Hvozdnická 
K Rybníčkům - č. 1 – 26 
Ke Strašnické 
Kolovratská `;
const processedInputText = inputText.replace(/–/g, "-");

const lexingResult = SmdLexer.tokenize(processedInputText);

if (lexingResult.errors.length > 0) {
  console.log(lexingResult.errors);
  console.log(JSON.stringify(lexingResult.errors));
  throw Error("Sad Sad Panda, lexing errors detected");
}

console.log(JSON.stringify(lexingResult, null, "\t"));

const tokens = lexingResult.tokens.map(
  (token) => "'" + token.image + "' (" + token.tokenType.name + ")"
);
console.log(tokens);

const parserInstance = new SmdParser([], { outputCst: true });
parserInstance.input = lexingResult.tokens;
const output = parserInstance.school();

if (parserInstance.errors.length > 0) {
  console.log(parserInstance.errors);
} else {
  console.log(JSON.stringify(output, null, "  "));
}
