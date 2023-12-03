import { DbMunicipalityResult, MunicipalityPartResult, SmdError } from "../street-markdown/types";
import { Founder, MunicipalityType } from "./types";
export declare const insertFounders: (founders: Founder[]) => Promise<number>;
export declare const getFounderById: (id: number) => Promise<{
    founder: Founder;
    errors: SmdError[];
}>;
export declare const findFounder: (nameWithHashtag: string) => Promise<{
    founder: Founder;
    errors: SmdError[];
}>;
export declare const getFounderCityCode: (founder: Founder) => Promise<number>;
export declare const findMunicipalityPartByName: (name: string, founder: Founder) => Promise<MunicipalityPartResult>;
export declare const findMunicipalityByNameAndType: (name: string, type: MunicipalityType, founder: Founder) => Promise<DbMunicipalityResult>;
