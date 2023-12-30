import { EmbeddedActionsParser, TokenVocabulary } from "chevrotain";
import { RichNumber, SmdLine } from "./types";
export declare class SmdParser extends EmbeddedActionsParser {
    constructor(tokenVocabulary: TokenVocabulary);
    street: import("chevrotain").ParserMethod<[], SmdLine[]>;
    private streetNameAndNumbersSpecs;
    private municipalityPartNameAndNumbersSpecs;
    private numberSpecs;
    private seriesSpecs;
    private _gatePostfixTypeSeriesSpec;
    private postfixTypeSeriesSpec;
    private rangeList;
    private seriesType;
    private rangeOrNumber;
    private range;
    private fromAndAbove;
    private fromAndAboveWithType;
    private toOrBelow;
    private toOrBelowWithType;
    private fullStreetNumber;
}
export declare const parseRichNumber: (number: string) => RichNumber;
export declare const parseMunicipalityPartName: (name: string) => string;
