import { Municipality as DbMunicipality } from "../db/types";
import { AddressPoint as CzechAddressPoint } from "czech-address";
export interface ProcessedSmdLines {
    smdLines: SmdLine[];
    errors: string[];
}
export interface SmdLine {
    street: string;
    numberSpec: SeriesSpec[] | NegativeSeriesSpec;
}
export interface WholeMunicipalitySmdLine extends SmdLine {
    wholeMunicipality: true;
    street: string;
    numberSpec: SeriesSpec[] | NegativeSeriesSpec;
}
export declare const isWholeMunicipalitySmdLine: (something: SmdLine | WholeMunicipalitySmdLine) => something is WholeMunicipalitySmdLine;
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
    descriptiveNumber: RichNumber;
    orientationalNumber: RichNumber;
}
export declare const isFullStreetNumber: (something: RangeSpec | FullStreetNumber) => something is FullStreetNumber;
export declare const isRange: (something: RangeSpec | FullStreetNumber) => something is RangeSpec;
export declare enum SeriesType {
    Even = 0,
    Odd = 1,
    All = 2,
    Descriptive = 3
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
}
export interface DbMunicipalityResult {
    municipality: DbMunicipality;
    errors: string[];
}
