"use strict";
// Written Docs for this tutorial step can be found here:
// https://chevrotain.io/docs/tutorial/step1_lexing.html

// Tutorial Step 1:
// Implementation of A lexer for a simple SELECT statement grammar
const chevrotain = require("chevrotain");
const Lexer = chevrotain.Lexer;
const createToken = chevrotain.createToken;

// the vocabulary will be exported and used in the Parser definition.
const tokenVocabulary = {};

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
const Hyphen = createToken({ name: "Hyphen", pattern: /-/ });
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
  AllType,
  CPType,
  Number,
  NewLine,
  Hyphen,
  Space,
  StreetName,
];

const SmdLexer = new Lexer(smdTokens);

smdTokens.forEach((tokenType) => {
  tokenVocabulary[tokenType.name] = tokenType;
});

module.exports = {
  tokenVocabulary: tokenVocabulary,

  lex: function (inputText) {
    const lexingResult = SmdLexer.tokenize(inputText);

    if (lexingResult.errors.length > 0) {
      throw Error("Sad Sad Panda, lexing errors detected");
    }

    return lexingResult;
  },
};
