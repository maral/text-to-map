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
  originalType?: string;
  municipalityType: MunicipalityType;
  schools: School[];
}

export enum MunicipalityType {
  City,
  District,
  Other,
}

interface Municipality {
  type: MunicipalityType;
  name: string;
}