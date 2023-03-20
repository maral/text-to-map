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

export enum MunicipalityType {
  City,
  District,
  Other,
}

export interface Municipality {
  type: MunicipalityType;
  code: number;
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
