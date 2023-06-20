import { Founder } from "../db/types";
import { OpenDataSyncOptionsPartial } from "../utils/helpers";
import { ErrorCallbackParams, Municipality, MunicipalityWithFounder, ProcessLineCallbackParams, School, SmdState } from "./types";
export declare const parseOrdinanceToAddressPoints: (lines: string[], options?: OpenDataSyncOptionsPartial, initialState?: Partial<SmdState>, onError?: (params: ErrorCallbackParams) => void, onWarning?: (params: ErrorCallbackParams) => void, onProcessedLine?: (params: ProcessLineCallbackParams) => void) => Municipality[];
export declare const convertMunicipality: (municipality: MunicipalityWithFounder) => Municipality;
export declare const getNewMunicipality: (name: string, options?: OpenDataSyncOptionsPartial) => MunicipalityWithFounder;
export declare const getNewSchool: (name: string, founder: Founder | null, options?: OpenDataSyncOptionsPartial) => School;
