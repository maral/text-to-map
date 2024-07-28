import chunk from "lodash/chunk";
import {
  extractKeyValuesPairs,
  getKnexDb,
  insertMultipleRows,
  rawQuery,
} from "./db";
import { FeatureCollection, MultiPolygon, Polygon } from "@turf/helpers";
import { PolygonsByCodes } from "./types";

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

  for (const arrayChunk of chunk(data, 1000)) {
    const queries = [];
    for (const row of arrayChunk) {
      queries.push(
        rawQuery(
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

export const setCityPolygonGeojson = async (
  code: string,
  polygon: FeatureCollection,
  districtsPolygon?: FeatureCollection
): Promise<void> => {
  await getKnexDb()
    .from("city")
    .update({
      polygon_geojson: JSON.stringify(polygon),
      ...(districtsPolygon
        ? { districts_polygon_geojson: JSON.stringify(districtsPolygon) }
        : {}),
    })
    .where({ code });
};

export const getCityPolygons = async (
  cityCodes: Set<number>
): Promise<PolygonsByCodes> => {
  if (cityCodes.size === 0) {
    return {};
  }
  const cityRows = await getKnexDb()
    .from("city")
    .select("code", "polygon_geojson")
    .whereIn("code", Array.from(cityCodes));

  return cityRows.reduce((acc, row) => {
    acc[row.code] = JSON.parse(row.polygon_geojson);
    return acc;
  }, {});
};

export const getDistrictPolygons = async (
  districtCodes: Set<number>
): Promise<PolygonsByCodes> => {
  if (districtCodes.size === 0) {
    return {};
  }
  const cityCodes = (
    await getKnexDb()
      .from("city_district")
      .select("city_code")
      .whereIn("code", Array.from(districtCodes))
      .groupBy("city_code")
  ).map((row) => row.city_code);

  const cityRows = await getKnexDb()
    .from("city")
    .select("code", "districts_polygon_geojson")
    .whereIn("code", cityCodes);

  const districtPolygons: PolygonsByCodes = {};
  for (const row of cityRows) {
    if (row.districts_polygon_geojson) {
      const polygons = JSON.parse(
        row.districts_polygon_geojson
      ) as FeatureCollection<Polygon | MultiPolygon>;
      for (const feature of polygons.features) {
        if (districtCodes.has(Number(feature.properties.KOD))) {
          districtPolygons[feature.properties.KOD] = {
            type: "FeatureCollection",
            features: [
              { ...feature, properties: { code: feature.properties.KOD } },
            ],
          };
        }
      }
    }
  }

  return districtPolygons;
};
