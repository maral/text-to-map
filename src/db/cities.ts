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

export const insertCityPositions = async (
  data: string[][]
): Promise<number> => {
  let changes = 0;

  // cities are most likely already inserted, but in case they're not,
  // we need to insert them before updating them with region data
  changes += await insertCities(data);
  const prev = changes;

  const knex = getKnexDb();

  for (const arrayChunk of chunk(data, 1000)) {
    const queries = [];
    for (const row of arrayChunk) {
      queries.push(
        knex.raw(
          `UPDATE city SET wgs84_latitude = ?, wgs84_longitude = ? WHERE code = ?`,
          [
            row[citiesColumn.latitude],
            row[citiesColumn.longitude],
            row[citiesColumn.cityCode],
          ]
        )
      );
    }
    await Promise.all(queries);
    changes += queries.length;
    console.log(`Done ${changes - prev} / ${data.length} rows...`);
  }

  return changes;
};

export const insertCities = async (buffer: string[][]): Promise<number> => {
  return await insertMultipleRows(
    extractKeyValuesPairs(buffer, citiesColumn.cityCode, [
      citiesColumn.cityName,
    ]),
    "city",
    ["code", "name"]
  );
};
