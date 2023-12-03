import { Founder } from "../db/types";
import { ErrorCallbackParams, Municipality, MunicipalityWithFounder, MunicipalityWithFounderResult, ProcessLineCallbackParams, School, SmdError, SmdState } from "./types";
interface ParseOrdinanceProps {
    lines: string[];
    initialState?: Partial<SmdState>;
    onError?: (params: ErrorCallbackParams) => void;
    onWarning?: (params: ErrorCallbackParams) => void;
    onProcessedLine?: (params: ProcessLineCallbackParams) => void;
    includeUnmappedAddressPoints: boolean;
}
export declare const parseOrdinanceToAddressPoints: ({ lines, initialState, onError, onWarning, onProcessedLine, includeUnmappedAddressPoints, }: ParseOrdinanceProps) => Promise<Municipality[]>;
export declare const convertMunicipality: (municipality: MunicipalityWithFounder) => Municipality;
export declare const getNewMunicipalityByName: (name: string) => Promise<MunicipalityWithFounderResult>;
export declare const getNewMunicipalityByFounderId: (founderId: number) => Promise<MunicipalityWithFounderResult>;
export declare const getNewSchool: (name: string, founder: Founder | null, lineNumber: number, onError: (params: ErrorCallbackParams) => void) => Promise<School>;
export declare const wholeLineError: (message: string, line: string) => SmdError;
export {};
