import { DbMunicipalityResult, SmdError } from "../street-markdown/types";
import { Founder, MunicipalityType } from "./types";
export declare const insertFounders: (founders: Founder[]) => Promise<number>;
export declare const findFounder: (nameWithHashtag: string) => Promise<{
    founder: Founder;
    errors: SmdError[];
}>;
export declare const getFounderCityCode: (founder: Founder) => Promise<number>;
export declare const findMunicipalityByNameAndType: (name: string, type: MunicipalityType) => Promise<DbMunicipalityResult>;
