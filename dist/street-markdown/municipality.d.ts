import { Founder } from "../db/types";
import { DbMunicipalityResult, MunicipalityPartResult } from "./types";
export declare const isMunicipalityPart: (line: string) => boolean;
export declare const getMunicipalityPart: (line: string, founder: Founder) => Promise<MunicipalityPartResult>;
export declare const isMunicipalitySwitch: (line: string) => boolean;
export declare const getSwitchMunicipality: (line: string, founder: Founder) => Promise<DbMunicipalityResult>;
export declare const isWholeMunicipality: (line: string) => boolean;
export declare const isNoStreetNameLine: (line: string) => boolean;
export declare const getWholeMunicipality: (line: string, founder: Founder) => Promise<DbMunicipalityResult>;
