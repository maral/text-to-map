import { Founder } from "../db/types";
import { ErrorCallbackParams, Municipality, MunicipalityWithFounder, ProcessLineCallbackParams, School, SmdError, SmdState } from "./types";
export declare const parseOrdinanceToAddressPoints: (lines: string[], initialState?: Partial<SmdState>, onError?: (params: ErrorCallbackParams) => void, onWarning?: (params: ErrorCallbackParams) => void, onProcessedLine?: (params: ProcessLineCallbackParams) => void) => Promise<Municipality[]>;
export declare const convertMunicipality: (municipality: MunicipalityWithFounder) => Municipality;
export declare const getNewMunicipalityByName: (name: string) => Promise<{
    municipality: MunicipalityWithFounder;
    errors: SmdError[];
}>;
export declare const getNewMunicipalityByFounderId: (founderId: number) => Promise<{
    municipality: MunicipalityWithFounder;
    errors: SmdError[];
}>;
export declare const getNewSchool: (name: string, founder: Founder | null, lineNumber: number, onError: (params: ErrorCallbackParams) => void) => Promise<School>;
export declare const wholeLineError: (message: string, line: string) => SmdError;
