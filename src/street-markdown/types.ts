import { Municipality as DbMunicipality } from "../db/types";
import { AddressPoint as CzechAddressPoint, AddressPointType } from "czech-address";

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

export const isWholeMunicipalitySmdLine = (
  something: SmdLine | WholeMunicipalitySmdLine
): something is WholeMunicipalitySmdLine =>
  something.hasOwnProperty("wholeMunicipality");

export interface SeriesSpec {
  type: SeriesType;
  ranges: (RangeSpec | FullStreetNumber)[];
}

export interface NegativeSeriesSpec extends SeriesSpec {
  negative: true;
}

export const isSeriesSpecArray = (
  something: SeriesSpec[] | NegativeSeriesSpec
): something is SeriesSpec[] => Array.isArray(something);

export const isNegativeSeriesSpec = (
  something: SeriesSpec[] | NegativeSeriesSpec
): something is SeriesSpec[] => something.hasOwnProperty("negative");

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

export const isFullStreetNumber = (
  something: RangeSpec | FullStreetNumber
): something is FullStreetNumber =>
  something.hasOwnProperty("orientationNumber");

export const isRange = (
  something: RangeSpec | FullStreetNumber
): something is RangeSpec => !something.hasOwnProperty("orientationNumber");

export enum SeriesType {
  Even,
  Odd,
  All,
  Descriptive,
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

export const isAddressPoint = (
  something: AddressPoint | ExportAddressPoint
): something is AddressPoint => something.hasOwnProperty("id");

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
