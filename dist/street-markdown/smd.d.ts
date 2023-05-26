import { Founder } from "../db/types";
import { OpenDataSyncOptions } from "../utils/helpers";
import { Municipality } from "./types";
interface MunicipalityWithFounder extends Municipality {
    founder: Founder | null;
}
export declare const parseOrdinanceToAddressPoints: (lines: string[], options?: OpenDataSyncOptions) => Municipality[];
export declare const convertMunicipality: (municipality: MunicipalityWithFounder) => Municipality;
export {};
