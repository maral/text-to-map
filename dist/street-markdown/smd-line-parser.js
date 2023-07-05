import { Lexer } from "chevrotain";
import { SmdParser } from "./smd-parser";
import { tokenVocabulary, smdTokens, resetTokenState, prepareLine, } from "./token-definition";
const printLexingResultInfo = (lexingResult) => {
    const tokens = lexingResult.tokens.map((token) => "'" + token.image + "' (" + token.tokenType.name + ")");
    console.error(tokens);
};
const smdLexer = new Lexer(smdTokens, { positionTracking: "onlyOffset" });
export const smdParser = new SmdParser(tokenVocabulary);
export const parseLine = (text, showDebug = false) => {
    resetTokenState(); // this is needed to reset the token state between lines
    const errors = [];
    const lexingResult = smdLexer.tokenize(prepareLine(text));
    if (lexingResult.errors.length > 0) {
        errors.push(...lexingResult.errors.map((error) => ({
            message: `Neočekávaný znak na tomto místě.`,
            startOffset: error.offset,
            endOffset: error.offset + error.length + 1,
        })));
        if (showDebug) {
            printLexingResultInfo(lexingResult);
        }
        return { smdLines: [], errors };
    }
    smdParser.input = lexingResult.tokens;
    const smdLines = smdParser.street();
    if (smdParser.errors.length > 0) {
        errors.push(...smdParser.errors.map((error) => {
            var _a;
            return ({
                message: `Nesprávný zápis pravidla - nevynechali jste něco?`,
                startOffset: error.token.startOffset,
                endOffset: (_a = error.token.endOffset) !== null && _a !== void 0 ? _a : text.length,
            });
        }));
        if (showDebug) {
            printLexingResultInfo(lexingResult);
        }
        return { smdLines: [], errors };
    }
    return { smdLines, errors };
};
