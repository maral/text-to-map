interface RegionsColumn {
    cityName: number;
    cityCode: number;
    cityType: number;
    orpName: number;
    orpCsuCode65: number;
    orpRuianCode: number;
    orpCityCode: number;
    countyName: number;
    countyCsuCode101Lau: number;
    countyCsuCode109Nuts: number;
    countyRuianCode: number;
    regionName: number;
    regionShortName: number;
    regionCsuCode100: number;
    regionCsuCode108Nuts: number;
    regionRuianCode: number;
}
export interface RegionsTableSchema {
    tableSchema: {
        columns: {
            name: string;
        }[];
    };
}
export declare const insertRegionsAndOrps: (data: string[][], schema: RegionsTableSchema) => number;
export declare const insertRegions: (buffer: string[][], columnIndex: RegionsColumn) => number;
export declare const insertCounties: (buffer: string[][], columnIndex: RegionsColumn) => number;
export declare const insertOrps: (buffer: string[][], columnIndex: RegionsColumn) => number;
export declare const insertCities: (buffer: string[][], columnIndex: RegionsColumn) => number;
export {};
