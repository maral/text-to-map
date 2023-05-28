import { extractKeyValuesPairs, getDb, insertMultipleRows } from "./db";

export const Column = {
  cityName: 0,
  cityCode: 1,
  cityType: 2,
  orpName: 9,
  orpCsuCode65: 10,
  orpRuianCode: 11,
  regionName: 17,
  regionShortName: 18,
  regionCsuCode100: 19,
  regionCsuCode108Nuts: 20,
  regionRuianCode: 21,
};

export const insertRegionsAndOrps = (data: string[][]): number => {
  insertRegions(data);
  insertOrps(data);

  // cities are most likely already inserted, but in case they're not,
  // we need to insert them before updating them with region data
  insertCities(data);

  const db = getDb();

  const updateStatement = db.prepare(
    `UPDATE city SET
      region_code = ?,
      orp_code = ?
    WHERE code = ?`
  );

  let changes = 0;
  data.forEach((data) => {
    changes += updateStatement.run(
      data[Column.regionRuianCode],
      data[Column.orpRuianCode],
      data[Column.cityCode]
    ).changes;
  });

  return changes;
};

export const insertRegions = (buffer: string[][]): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.regionRuianCode, [
      Column.regionName,
      Column.regionShortName,
      Column.regionCsuCode100,
      Column.regionCsuCode108Nuts,
    ]),
    "region",
    ["code", "name", "short_name", "csu_code_100", "csu_code_108_nuts"]
  );
};

export const insertOrps = (buffer: string[][]): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.orpRuianCode, [
      Column.orpName,
      Column.orpCsuCode65,
      Column.regionRuianCode,
    ]),
    "orp",
    ["code", "name", "csu_code_65", "region_code"]
  );
};

export const insertCities = (buffer: string[][]): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, Column.cityCode, [Column.cityName]),
    "city",
    ["code", "name"]
  );
};
