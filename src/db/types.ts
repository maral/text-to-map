export interface SchoolLocation {
  id?: number;
  schoolIzo?: number;
  addressPointId: number;
}

export interface School {
  name: string;
  izo: string;
  redizo: string;
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

export enum MunicipalityType {
  City,
  District,
  Other,
}

export interface Position {
  lat: number;
  lng: number;
}

export interface Municipality {
  type: MunicipalityType;
  code: number;
}

export type MunicipalityWithPosition = Municipality & Position;

export interface PlaceWithPosition {
  code: number;
  lat: number;
  lng: number;
}


export const founderToMunicipality = (founder: Founder): Municipality => {
  return {
    type: founder.municipalityType,
    code: founder.cityOrDistrictCode,
  };
};

export interface DbfStreet {
  KOD: string;
  NAZEV: string;
  OBEC_KOD: string;
}

export enum SyncPart {
  AddressPoints = "address-points",
  Schools = "schools",
  Regions = "regions",
  Streets = "streets",
}
