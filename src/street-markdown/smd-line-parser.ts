import { ILexingResult, Lexer } from "chevrotain";
import { SmdParser } from "./smd-parser";

import {
  tokenVocabulary,
  smdTokens,
  resetTokenState,
  prepareLine,
} from "./token-definition";
import { ProcessedSmdLines, SmdError } from "./types";

const printLexingResultInfo = (lexingResult: ILexingResult) => {
  const tokens = lexingResult.tokens.map(
    (token) => "'" + token.image + "' (" + token.tokenType.name + ")"
  );
  console.error(tokens);
};

const smdLexer = new Lexer(smdTokens, { positionTracking: "onlyOffset" });
export const smdParser = new SmdParser(tokenVocabulary);

export const parseLine = (
  text: string,
  showDebug = false
): ProcessedSmdLines => {
  resetTokenState(); // this is needed to reset the token state between lines
  const errors: SmdError[] = [];

  const lexingResult = smdLexer.tokenize(prepareLine(text));

  if (lexingResult.errors.length > 0) {
    errors.push(
      ...lexingResult.errors.map((error) => ({
        message: `Neočekávaný znak na tomto místě.`,
        startOffset: error.offset,
        endOffset: error.offset + error.length + 1,
      }))
    );
    if (showDebug) {
      printLexingResultInfo(lexingResult);
    }
    return { smdLines: [], errors };
  }

  smdParser.input = lexingResult.tokens;
  const smdLines = smdParser.street();

  if (smdParser.errors.length > 0) {
    errors.push(
      ...smdParser.errors.map((error) => ({
        message: `Nesprávný zápis pravidla - nevynechali jste něco?`,
        startOffset: error.token.startOffset,
        endOffset: error.token.endOffset ?? text.length,
      }))
    );
    if (showDebug) {
      printLexingResultInfo(lexingResult);
    }
    return { smdLines: [], errors };
  }

  return { smdLines, errors };
};
