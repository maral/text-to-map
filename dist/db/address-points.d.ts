import { AddressPoint, FullStreetNumber, RangeSpec, SeriesType, SmdError, SmdLine } from "../street-markdown/types";
import { Founder, Municipality } from "./types";
export declare const Column: {
    admCode: number;
    cityCode: number;
    cityName: number;
    districtCode: number;
    districtName: number;
    pragueDistrictCode: number;
    pragueDistrictName: number;
    municipalityPartCode: number;
    municipalityPartName: number;
    streetCode: number;
    streetName: number;
    objectType: number;
    houseNumber: number;
    orientationalNumber: number;
    orientationalNumberLetter: number;
    postalCode: number;
    yCoordinate: number;
    xCoordinate: number;
    validFrom: number;
};
export declare const commitAddressPoints: (buffer: string[][]) => Promise<number>;
export declare const insertCities: (buffer: string[][]) => Promise<number>;
export declare const insertDistricts: (buffer: string[][]) => Promise<number>;
export declare const insertMunicipalityParts: (buffer: string[][]) => Promise<number>;
export declare const insertPragueDistricts: (buffer: string[][]) => Promise<number>;
export declare const insertStreets: (buffer: string[][]) => Promise<number>;
export declare const areAddressPointsSynced: () => Promise<boolean>;
export declare const getAddressPointById: (addressPointId: number) => Promise<AddressPoint | null>;
export declare const checkStreetExists: (streetName: string, founder: Founder) => Promise<{
    exists: boolean;
    errors: SmdError[];
}>;
export type FindAddressPointsParams = {
    type: "smdLine";
    smdLine: SmdLine;
    municipality: Municipality;
    municipalityPartCode?: number;
} | {
    type: "wholeMunicipalityPart";
    municipalityPartCode: number;
} | {
    type: "wholeMunicipality";
    municipality: Municipality;
} | {
    type: "wholeMunicipalityNoStreetName";
    municipality: Municipality;
};
export declare const findAddressPoints: (params: FindAddressPointsParams) => Promise<AddressPoint[]>;
export declare const filterAddressPoints: (addressPoints: AddressPoint[], params: FindAddressPointsParams) => AddressPoint[];
export declare const getQueryParams: (params: FindAddressPointsParams) => (string | number)[];
export declare const getStreetJoinCondition: (params: FindAddressPointsParams) => string;
export declare const getWhereCondition: (params: FindAddressPointsParams) => string;
export declare const isInRange: (number: number | null, letter: string | null, range: RangeSpec) => boolean;
export declare const fitsType: (number: number | null, type: SeriesType) => boolean;
export declare const equalsFullStreetNumber: (fullStreetNumber: FullStreetNumber, addressPoint: AddressPoint) => boolean;
