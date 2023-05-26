export interface SchoolLocation {
    id?: number;
    schoolIzo?: number;
    addressPointId: number;
}
export interface School {
    name: string;
    izo: string;
    capacity: number;
    locations: SchoolLocation[];
}
export interface Founder {
    name: string;
    ico: string;
    originalType?: number;
    municipalityType: MunicipalityType;
    cityOrDistrictCode?: number;
    schools: School[];
}
export declare enum MunicipalityType {
    City = 0,
    District = 1,
    Other = 2
}
export interface Municipality {
    type: MunicipalityType;
    code: number;
}
export declare const founderToMunicipality: (founder: Founder) => Municipality;
export interface DbfStreet {
    KOD: string;
    NAZEV: string;
    OBEC_KOD: string;
}
