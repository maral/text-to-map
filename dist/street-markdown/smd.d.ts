import { Founder } from "../db/types";
import { OpenDataSyncOptionsPartial } from "../utils/helpers";
import { ErrorCallbackParams, Municipality, MunicipalityWithFounder, ProcessLineCallbackParams, School, SmdError, SmdState } from "./types";
export declare const parseOrdinanceToAddressPoints: (lines: string[], options?: OpenDataSyncOptionsPartial, initialState?: Partial<SmdState>, onError?: (params: ErrorCallbackParams) => void, onWarning?: (params: ErrorCallbackParams) => void, onProcessedLine?: (params: ProcessLineCallbackParams) => void) => Municipality[];
export declare const convertMunicipality: (municipality: MunicipalityWithFounder) => Municipality;
export declare const getNewMunicipality: (name: string, options?: OpenDataSyncOptionsPartial) => {
    municipality: MunicipalityWithFounder;
    errors: SmdError[];
};
export declare const getNewSchool: (name: string, founder: Founder | null, lineNumber: number, onError: (params: ErrorCallbackParams) => void, options?: OpenDataSyncOptionsPartial) => School;
export declare const wholeLineError: (message: string, line: string) => SmdError;
