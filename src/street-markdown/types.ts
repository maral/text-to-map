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
  orientationNumber: RichNumber;
  descriptiveNumber: RichNumber;
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
  address: string;
  type: AddressPointType;
  street: string;
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
