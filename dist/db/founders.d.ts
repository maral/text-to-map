import { Founder, MunicipalityType } from "./types";
import { DbMunicipalityResult, SmdError } from "../street-markdown/types";
export declare const insertFounders: (founders: Founder[]) => number;
export declare const findFounder: (nameWithHashtag: string) => {
    founder: Founder;
    errors: SmdError[];
};
export declare const getFounderCityCode: (founder: Founder) => number;
export declare const findMunicipalityByNameAndType: (name: string, type: MunicipalityType) => DbMunicipalityResult;
