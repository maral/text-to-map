import { ILexingResult, Lexer } from "chevrotain";
import { SmdParser } from "./smd-parser";
// const token_definition = require("token_definition");

import {
  tokenVocabulary,
  smdTokens,
  resetTokenState,
  prepareLine,
} from "./token-definition";
import { ProcessedSmdLines, SmdLine } from "./types";

const printLexingResultInfo = (lexingResult: ILexingResult) => {
  // console.error(JSON.stringify(lexingResult, null, "\t"));

  const tokens = lexingResult.tokens.map(
    (token) => "'" + token.image + "' (" + token.tokenType.name + ")"
  );
  console.error(tokens);
};

const smdLexer = new Lexer(smdTokens, { positionTracking: "onlyOffset" });
export const smdParser = new SmdParser(tokenVocabulary);

export const parseLine = (text: string): ProcessedSmdLines => {
  resetTokenState(); // this is needed to reset the token state between lines
  const errors: string[] = [];

  const lexingResult = smdLexer.tokenize(prepareLine(text));

  if (lexingResult.errors.length > 0) {
    errors.push(...lexingResult.errors.map((error) => error.message));
    printLexingResultInfo(lexingResult);
    return { smdLines: [], errors };
  }

  // printLexingResultInfo(lexingResult);

  smdParser.input = lexingResult.tokens;
  const smdLines = <SmdLine[]>(<unknown>smdParser.street());

  if (smdParser.errors.length > 0) {
    errors.push(...smdParser.errors.map((error) => error.message));
    printLexingResultInfo(lexingResult);
  }

  return { smdLines, errors };
};
