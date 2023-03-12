import { ILexingResult, Lexer } from "chevrotain";
import { SmdParser } from "./smd-parser";
// const token_definition = require("token_definition");

import { tokenVocabulary, smdTokens } from "./token-definition";
import { SmdLine } from "./types";

const printLexingResultInfo = (lexingResult: ILexingResult) => {
  console.log(JSON.stringify(lexingResult, null, "\t"));

  const tokens = lexingResult.tokens.map(
    (token) => "'" + token.image + "' (" + token.tokenType.name + ")"
  );
  console.log(tokens);
};

const smdLexer = new Lexer(smdTokens);
const smdParser = new SmdParser(tokenVocabulary);

export const parseLine = (text: string): SmdLine | null => {
  const lexingResult = smdLexer.tokenize(text);

  // printLexingResultInfo(lexingResult);

  if (lexingResult.errors.length > 0) {
    console.error(lexingResult.errors);
    console.error(JSON.stringify(lexingResult.errors));
    return null;
  }

  smdParser.input = lexingResult.tokens;
  const output = <SmdLine>(<unknown>smdParser.street());

  if (smdParser.errors.length > 0) {
    console.error(smdParser.errors);
  }

  return output;
};
