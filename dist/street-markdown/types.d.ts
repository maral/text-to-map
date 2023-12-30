import { AddressPoint as CzechAddressPoint } from "czech-address";
import { Municipality as DbMunicipality, Founder } from "../db/types";
export interface ProcessedSmdLines {
    smdLines: SmdLine[];
    errors: SmdError[];
}
export type SmdLineType = "street" | "wholeMunicipalityLine" | "municipalitySwitch" | "municipalityPart";
export type SmdLine = {
    type: "street";
    street: string;
    numberSpec: SeriesSpec[] | NegativeSeriesSpec;
} | {
    type: "municipalityPart";
    municipalityPart: string;
    numberSpec: SeriesSpec[] | NegativeSeriesSpec;
};
export interface SeriesSpec {
    type: SeriesType;
    ranges: (RangeSpec | FullStreetNumber)[];
}
export interface NegativeSeriesSpec extends SeriesSpec {
    negative: true;
}
export declare const isSeriesSpecArray: (something: SeriesSpec[] | NegativeSeriesSpec) => something is SeriesSpec[];
export declare const isNegativeSeriesSpec: (something: SeriesSpec[] | NegativeSeriesSpec) => something is SeriesSpec[];
export interface RangeSpec {
    from?: RichNumber;
    to?: RichNumber;
}
export interface RichNumber {
    number: number;
    letter?: string;
}
export interface FullStreetNumber {
    descriptionNumber: RichNumber;
    orientationalNumber: RichNumber;
}
export declare const isFullStreetNumber: (something: RangeSpec | FullStreetNumber) => something is FullStreetNumber;
export declare const isRange: (something: RangeSpec | FullStreetNumber) => something is RangeSpec;
export declare enum SeriesType {
    Even = 0,
    Odd = 1,
    All = 2,
    Description = 3
}
export interface AddressPoint extends CzechAddressPoint {
    id: number;
    address: string;
    lat: number;
    lng: number;
}
export interface ExportAddressPoint {
    address: string;
    lat: number;
    lng: number;
}
export declare const isAddressPoint: (something: AddressPoint | ExportAddressPoint) => something is AddressPoint;
export interface School {
    name: string;
    izo: string;
    position?: AddressPoint | ExportAddressPoint;
    addresses: ExportAddressPoint[];
}
export interface Municipality {
    municipalityName: string;
    schools: School[];
    unmappedPoints: ExportAddressPoint[];
}
export interface DbMunicipalityResult {
    municipality: DbMunicipality;
    errors: SmdError[];
}
export interface MunicipalityPartResult {
    municipalityPartCode: number;
    errors: SmdError[];
}
export interface MunicipalityWithFounder extends Municipality {
    founder: Founder | null;
}
export interface MunicipalityWithFounderResult {
    municipality: MunicipalityWithFounder;
    errors: SmdError[];
}
export interface SmdState {
    currentMunicipality: MunicipalityWithFounder;
    currentFilterMunicipality: DbMunicipality;
    currentSchool: School;
    rests: {
        noStreetNameSchoolIzo: string;
        municipalityParts: {
            municipalityPartCode: number;
            schoolIzo: string;
        }[];
        wholeMunicipalitySchoolIzo: string;
        includeUnmappedAddressPoints: boolean;
    };
    municipalities: Municipality[];
}
export interface ProcessLineCallbackParams {
    lineNumber: number;
    line: string;
}
export interface ErrorCallbackParams extends ProcessLineCallbackParams {
    errors: SmdError[];
}
export interface ProcessLineParams {
    line: string;
    state: SmdState;
    lineNumber: number;
    onError: (params: ErrorCallbackParams) => void;
    onWarning: (params: ErrorCallbackParams) => void;
}
export interface SmdError {
    startOffset: number;
    endOffset: number;
    message: string;
}