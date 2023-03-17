export interface ProcessedSmdLines {
  smdLines: SmdLine[];
  errors: string[];
}

export interface SmdLine {
  street: string;
  numberSpec: SeriesSpec[];
}

export interface SeriesSpec {
  type: SeriesType;
  ranges: (RangeSpec | FullStreetNumber)[];
}

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

export enum AddressPointType {
  Descriptive, // číslo popisné
  Registration, // číslo evidenční
}

export interface AddressPoint {
  id: number;
  address: string;
  type: AddressPointType;
  street?: string;
  descriptiveNumber: number;
  orientationalNumber?: number;
  orientationalNumberLetter?: string;
  postalCode: string;
  city: string;
  district?: string;
  municipalityPart?: string;
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
  position?: AddressPoint | ExportAddressPoint;
  addresses: ExportAddressPoint[];
}

export interface Municipality {
  municipalityName: string;
  schools: School[];
}