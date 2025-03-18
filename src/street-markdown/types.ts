import { AddressPoint as CzechAddressPoint } from "czech-address";
import {
  Municipality as DbMunicipality,
  Founder,
  SchoolType,
} from "../db/types";

export interface ProcessedSmdLines {
  smdLines: SmdLine[];
  errors: SmdError[];
}

export type SmdLineType =
  | "street"
  | "wholeMunicipalityLine"
  | "municipalitySwitch"
  | "municipalityPart";

export type SmdLine =
  | {
      type: "street";
      street: string;
      numberSpec: SeriesSpec[] | NegativeSeriesSpec;
    }
  | {
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
  descriptionNumber: RichNumber;
  orientationalNumber: RichNumber;
}

export const isFullStreetNumber = (
  something: RangeSpec | FullStreetNumber
): something is FullStreetNumber =>
  something.hasOwnProperty("orientationalNumber");

export const isRange = (
  something: RangeSpec | FullStreetNumber
): something is RangeSpec => !something.hasOwnProperty("orientationalNumber");

export enum SeriesType {
  Even,
  Odd,
  All,
  Description,
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
  lineNumbers?: number[];
  // defined if the point is in a different municipality, except a whole municipality for the same school
  municipalityCode?: number;
}

export const isAddressPoint = (
  something: AddressPoint | ExportAddressPoint
): something is AddressPoint => something.hasOwnProperty("id");

export interface School {
  name: string;
  izo: string;
  position?: AddressPoint | ExportAddressPoint;
}

export interface IntermediateSchool extends School {
  addressMap: Map<number, ExportAddressPoint>;
}

export interface Area {
  index: number;
  schools: School[];
  addresses: ExportAddressPoint[];
}

export interface IntermediateArea extends Area {
  addressMap: Map<number, ExportAddressPoint>;
  allSchoolsAdded: boolean;
}

export interface Municipality {
  municipalityName: string;
  code: number;
  municipalityType: "city" | "district";
  cityCodes: number[];
  districtCodes: number[];
  areas: Area[];
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

export interface IntermediateMunicipality extends MunicipalityWithFounder {
  areas: IntermediateArea[];
}

export interface IntermediateMunicipalityResult {
  municipality: IntermediateMunicipality;
  errors: SmdError[];
}

export interface SmdState {
  currentMunicipality: IntermediateMunicipality;
  currentFilterMunicipality: DbMunicipality;
  currentArea: IntermediateArea;
  schoolsCompleted: boolean;
  areaCount: number;
  rests: {
    noStreetNameArea: {
      areaIndex: number;
      lineNumber: number;
    };
    municipalityParts: {
      municipalityPartCode: number;
      areaIndex: number;
      lineNumber: number;
    }[];
    wholeMunicipalityArea: {
      areaIndex: number;
      lineNumber: number;
    };
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
  rawLine: string;
  state: SmdState;
  lineNumber: number;
  schoolType: SchoolType;
  onError: (params: ErrorCallbackParams) => void;
  onWarning: (params: ErrorCallbackParams) => void;
}

export interface SmdError {
  startOffset: number;
  endOffset: number;
  message: string;
}
