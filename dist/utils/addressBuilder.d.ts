import { AddressPoint } from "../street-markdown/types";
export interface ThreeRowsAddress {
    firstRow: string;
    secondRow: string;
    thirdRow: string;
}
export declare const buildInline: (address: AddressPoint) => string;
export declare const build: (address: AddressPoint) => ThreeRowsAddress;
