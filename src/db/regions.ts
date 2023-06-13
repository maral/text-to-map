import { extractKeyValuesPairs, getDb, insertMultipleRows } from "./db";

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

export const insertRegionsAndOrps = (
  data: string[][],
  schema: RegionsTableSchema
): number => {
  const columnIndex = getColumnIndexFromSchema(schema);

  let changes = 0;
  changes += insertRegions(data, columnIndex);
  changes += insertCounties(data, columnIndex);
  changes += insertOrps(data, columnIndex);

  // cities are most likely already inserted, but in case they're not,
  // we need to insert them before updating them with region data
  changes += insertCities(data, columnIndex);

  const db = getDb();

  const updateStatement = db.prepare(
    `UPDATE city SET
      region_code = ?,
      county_code = ?,
      orp_code = ?
    WHERE code = ?`
  );

  data.forEach((data) => {
    changes += updateStatement.run(
      data[columnIndex.regionRuianCode],
      data[columnIndex.countyRuianCode],
      data[columnIndex.orpRuianCode],
      data[columnIndex.cityCode]
    ).changes;
  });

  return changes;
};

export const insertRegions = (
  buffer: string[][],
  columnIndex: RegionsColumn
): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, columnIndex.regionRuianCode, [
      columnIndex.regionName,
      columnIndex.regionShortName,
      columnIndex.regionCsuCode100,
      columnIndex.regionCsuCode108Nuts,
    ]),
    "region",
    ["code", "name", "short_name", "csu_code_100", "csu_code_108_nuts"]
  );
};

export const insertCounties = (
  buffer: string[][],
  columnIndex: RegionsColumn
): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, columnIndex.countyRuianCode, [
      columnIndex.countyName,
      columnIndex.countyCsuCode101Lau,
      columnIndex.countyCsuCode109Nuts,
      columnIndex.regionRuianCode,
    ]),
    "county",
    ["code", "name", "csu_code_101_lau", "csu_code_109_nuts", "region_code"]
  );
};

export const insertOrps = (
  buffer: string[][],
  columnIndex: RegionsColumn
): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, columnIndex.orpRuianCode, [
      columnIndex.orpName,
      columnIndex.orpCsuCode65,
      columnIndex.regionRuianCode,
      columnIndex.countyRuianCode,
    ]),
    "orp",
    ["code", "name", "csu_code_65", "region_code", "county_code"]
  );
};

export const insertCities = (
  buffer: string[][],
  columnIndex: RegionsColumn
): number => {
  return insertMultipleRows(
    extractKeyValuesPairs(buffer, columnIndex.cityCode, [columnIndex.cityName]),
    "city",
    ["code", "name"]
  );
};

const getColumnIndexFromSchema = (
  schema: RegionsTableSchema
): RegionsColumn => {
  const names = schema.tableSchema.columns.map((column) => column.name);

  const columnIndex: RegionsColumn = {
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

const findOrDie = (columnNames: string[], name: string): number => {
  const index = columnNames.indexOf(name);
  if (index < 0) {
    throw new Error(
      `Column '${name}' not found in region schema. Check https://data.gov.cz/datov%C3%A1-sada?iri=https%3A%2F%2Fdata.gov.cz%2Fzdroj%2Fdatov%C3%A9-sady%2F00025593%2F271b0fb7c2abb7f44e12ad57617821b2 for current dataset info or search for 'Struktura území ČR se všemi kódy území od obcí po stát dle číselníků ČSÚ, klasifikace NUTS a kódů RÚIAN.'.`
    );
  }
  return index;
};
