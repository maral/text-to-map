import { Founder, MunicipalityType } from "./types";
import { DbMunicipalityResult } from "../street-markdown/types";
export declare const insertFounders: (founders: Founder[]) => number;
export declare const findFounder: (name: string) => {
    founder: Founder;
    errors: string[];
};
export declare const getFounderCityCode: (founder: Founder) => number;
export declare const findMunicipalityByNameAndType: (name: string, type: MunicipalityType) => DbMunicipalityResult;
