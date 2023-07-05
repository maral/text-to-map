import { DbMunicipalityResult } from "./types";
export declare const isMunicipalitySwitch: (line: string) => boolean;
export declare const getSwitchMunicipality: (line: string) => Promise<DbMunicipalityResult>;
export declare const isWholeMunicipality: (line: string) => boolean;
export declare const getWholeMunicipality: (line: string) => Promise<DbMunicipalityResult>;
