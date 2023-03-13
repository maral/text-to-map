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

const smdLexer = new Lexer(smdTokens, { positionTracking: "onlyOffset" });
const smdParser = new SmdParser(tokenVocabulary);

export const parseLine = (
  text: string
): { smdLine: SmdLine | null; errors: string[] } => {
  const errors: string[] = [];
  const lexingResult = smdLexer.tokenize(text);

  if (lexingResult.errors.length > 0) {
    errors.push(...lexingResult.errors.map((error) => error.message));
    return { smdLine: null, errors };
  }

  // printLexingResultInfo(lexingResult);

  smdParser.input = lexingResult.tokens;
  const smdLine = <SmdLine>(<unknown>smdParser.street());
  if (smdLine) {
    smdLine.numberSpec = smdLine.numberSpec ?? [];
  }

  if (smdParser.errors.length > 0) {
    errors.push(...smdParser.errors.map((error) => error.message));
  }

  return { smdLine, errors };
};
