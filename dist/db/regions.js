var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { extractKeyValuesPairs, getKnexDb, insertMultipleRows } from "./db";
export const insertRegionsAndOrps = (data, schema) => __awaiter(void 0, void 0, void 0, function* () {
    const columnIndex = getColumnIndexFromSchema(schema);
    let changes = 0;
    changes += yield insertRegions(data, columnIndex);
    changes += yield insertCounties(data, columnIndex);
    changes += yield insertOrps(data, columnIndex);
    // cities are most likely already inserted, but in case they're not,
    // we need to insert them before updating them with region data
    changes += yield insertCities(data, columnIndex);
    const knex = getKnexDb();
    for (const row of data) {
        yield knex
            .from("city")
            .update({
            region_code: row[columnIndex.regionRuianCode],
            county_code: row[columnIndex.countyRuianCode],
            orp_code: row[columnIndex.orpRuianCode],
        })
            .where({ code: row[columnIndex.cityCode] });
        changes++;
    }
    return changes;
});
export const insertRegions = (buffer, columnIndex) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, columnIndex.regionRuianCode, [
        columnIndex.regionName,
        columnIndex.regionShortName,
        columnIndex.regionCsuCode100,
        columnIndex.regionCsuCode108Nuts,
    ]), "region", ["code", "name", "short_name", "csu_code_100", "csu_code_108_nuts"]);
});
export const insertCounties = (buffer, columnIndex) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, columnIndex.countyRuianCode, [
        columnIndex.countyName,
        columnIndex.countyCsuCode101Lau,
        columnIndex.countyCsuCode109Nuts,
        columnIndex.regionRuianCode,
    ]), "county", ["code", "name", "csu_code_101_lau", "csu_code_109_nuts", "region_code"]);
});
export const insertOrps = (buffer, columnIndex) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, columnIndex.orpRuianCode, [
        columnIndex.orpName,
        columnIndex.orpCsuCode65,
        columnIndex.regionRuianCode,
        columnIndex.countyRuianCode,
    ]), "orp", ["code", "name", "csu_code_65", "region_code", "county_code"]);
});
export const insertCities = (buffer, columnIndex) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, columnIndex.cityCode, [columnIndex.cityName]), "city", ["code", "name"]);
});
const getColumnIndexFromSchema = (schema) => {
    const names = schema.tableSchema.columns.map((column) => column.name);
    const columnIndex = {
        cityName: findOrDie(names, "obec_text"),
        cityCode: findOrDie(names, "obec_kod"),
        cityType: findOrDie(names, "obec_typ"),
        orpName: findOrDie(names, "orp_text"),
        orpCsuCode65: findOrDie(names, "orp_csu_cis65_kod"),
        orpRuianCode: findOrDie(names, "orp_ruian_kod"),
        orpCityCode: findOrDie(names, "orp_sidlo_obec_kod"),
        countyName: findOrDie(names, "okres_text"),
        countyCsuCode101Lau: findOrDie(names, "okres_csu_cis101_lau_kod"),
        countyCsuCode109Nuts: findOrDie(names, "okres_csu_cis109_nuts_kod"),
        countyRuianCode: findOrDie(names, "okres_ruian_kod"),
        regionName: findOrDie(names, "kraj_text"),
        regionShortName: findOrDie(names, "kraj_zkratka"),
        regionCsuCode100: findOrDie(names, "kraj_csu_cis100_kod"),
        regionCsuCode108Nuts: findOrDie(names, "kraj_csu_cis108_nuts_kod"),
        regionRuianCode: findOrDie(names, "kraj_ruian_vusc_kod"),
    };
    return columnIndex;
};
const findOrDie = (columnNames, name) => {
    const index = columnNames.indexOf(name);
    if (index < 0) {
        throw new Error(`Column '${name}' not found in region schema. Check https://data.gov.cz/datov%C3%A1-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatov%C3%A9-sady%2F00025593%2F271b0fb7c2abb7f44e12ad57617821b2 for current dataset info or search for 'Struktura území ČR se všemi kódy území od obcí po stát dle číselníků ČSÚ, klasifikace NUTS a kódů RÚIAN.'.`);
    }
    return index;
};
