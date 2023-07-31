var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import chunk from "lodash/chunk";
import { extractKeyValuesPairs, getKnexDb, insertMultipleRows } from "./db";
const citiesColumn = {
    cityName: 0,
    cityCode: 1,
    countyName: 2,
    countyCode: 3,
    regionName: 4,
    regionCode: 5,
    postalCode: 6,
    latitude: 7,
    longitude: 8,
};
export const insertCityPositions = (data) => __awaiter(void 0, void 0, void 0, function* () {
    let changes = 0;
    // cities are most likely already inserted, but in case they're not,
    // we need to insert them before updating them with region data
    changes += yield insertCities(data);
    const prev = changes;
    const knex = getKnexDb();
    for (const arrayChunk of chunk(data, 1000)) {
        const queries = [];
        for (const row of arrayChunk) {
            queries.push(knex.raw(`UPDATE city SET wgs84_latitude = ?, wgs84_longitude = ? WHERE code = ?`, [
                row[citiesColumn.latitude],
                row[citiesColumn.longitude],
                row[citiesColumn.cityCode],
            ]));
        }
        yield Promise.all(queries);
        changes += queries.length;
        console.log(`Done ${changes - prev} / ${data.length} rows...`);
    }
    return changes;
});
export const insertCities = (buffer) => __awaiter(void 0, void 0, void 0, function* () {
    return yield insertMultipleRows(extractKeyValuesPairs(buffer, citiesColumn.cityCode, [
        citiesColumn.cityName,
    ]), "city", ["code", "name"]);
});
