import { Delaunay } from "d3-delaunay";
import { Municipality } from "./types";

import {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
  featureCollection,
} from "@turf/helpers";
import intersect from "@turf/intersect";
import { toMercator, toWgs84 } from "@turf/projection";
import union from "@turf/union";
import { getCityPolygonGeojsons } from "../db/cities";

type PolygonProps = {
  schools: string[];
  index: number;
  neighbors: Set<number>;
};

export const municipalityToPolygons = async (
  municipality: Municipality
): Promise<FeatureCollection> => {
  const cityPolygons = await getCityPolygonGeojsons(municipality.cityCodes);
  return createPolygons(municipality, Object.values(cityPolygons));
};

export const createPolygons = (
  municipality: Municipality,
  cityPolygons: FeatureCollection<Polygon | MultiPolygon>[]
): FeatureCollection => {
  const citiesMultipolygon = createCitiesMultipolygon(cityPolygons);
  const uniquePoints = new Map<string, Feature>();

  for (const school of municipality.schools) {
    for (const point of school.addresses) {
      if (!uniquePoints.has(point.address)) {
        uniquePoints.set(point.address, {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [point.lng, point.lat],
          },
          properties: {
            schools: [school.izo],
          },
        });
      } else {
        uniquePoints.get(point.address).properties.schools.push(school.izo);
      }
    }
  }

  const points = {
    type: "FeatureCollection",
    features: Array.from(uniquePoints.values()),
  } as FeatureCollection<Point>;

  const polygons = d3DelaunayVoronoi(points);

  const unitedPolygons: Feature[] = [];
  for (const school of municipality.schools) {
    const schoolPolygons = polygons.features.filter((polygon) =>
      polygon.properties.schools.includes(school.izo)
    );

    const polygonMap = new Map<
      number,
      Feature<Polygon | MultiPolygon, PolygonProps>
    >();

    for (const polygon of schoolPolygons) {
      polygonMap.set(polygon.properties.index, polygon);
    }

    // TODO: coloring of polygons
    // - just take note of all the school IZOs in the neighboring polygons
    // - create a graph
    // - color the graph (using some library)
    // - do not give an exact color, just an index of the color
    while (polygonMap.size > 0) {
      const index = polygonMap.keys().next().value;
      let polygon = polygonMap.get(index);
      polygonMap.delete(index);
      const neighbors = new Set(polygon.properties.neighbors);
      while (neighbors.size > 0) {
        const neighborKey = neighbors.values().next().value;

        // neighbor is the polygon itself or is not in polygonMap
        if (!polygonMap.has(neighborKey)) {
          neighbors.delete(neighborKey);
          continue;
        }

        const neighborPolygon = polygonMap.get(neighborKey);
        neighbors.delete(neighborKey);
        polygonMap.delete(neighborKey);
        polygon = union(
          featureCollection([polygon, neighborPolygon])
        ) as Feature<Polygon | MultiPolygon, PolygonProps>;
        neighborPolygon.properties.neighbors.forEach((neighbor) => {
          neighbors.add(neighbor);
        });
      }
      const intersection = intersect(polygon, citiesMultipolygon);
      if (!intersection) {
        throw new Error("Polygon does not intersect with city borders");
      }
      const result = { ...intersection, properties: { schoolIzo: school.izo } };
      unitedPolygons.push(result);
    }
  }

  const { type } = polygons;
  return {
    type,
    features: [...unitedPolygons],
  };
};

const d3DelaunayVoronoi = (
  points: FeatureCollection<Point>
): FeatureCollection<Polygon, PolygonProps> => {
  const converted = points.features.map((p) =>
    toMercator([p.geometry.coordinates[0], p.geometry.coordinates[1]])
  );

  const bbox = [...toMercator([-180, -85]), ...toMercator([180, 85])] as [
    number,
    number,
    number,
    number
  ];

  const delaunay = new Delaunay(Float64Array.of(...converted.flat()));
  const voronoi = delaunay.voronoi(bbox);
  return {
    type: "FeatureCollection",
    features: Array.from(voronoi.cellPolygons()).map((polygon, i) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [polygon.map((p) => toWgs84(p))],
      },
      properties: {
        schools: points.features[i].properties.schools,
        index: i,
        neighbors: new Set(voronoi.neighbors(polygon.index)),
      },
    })),
  };
};

const intersectWithCityBorders = (
  multipolygon: Feature<Polygon | MultiPolygon>,
  cityPolygons: FeatureCollection<Polygon | MultiPolygon>[]
): Feature<Polygon | MultiPolygon> => {
  const citiesMultipolygon = createCitiesMultipolygon(cityPolygons);
  const intersection = intersect(multipolygon, citiesMultipolygon);
  if (!intersection) {
    throw new Error("Polygon does not intersect with city borders");
  }
  return intersection;
};

const createCitiesMultipolygon = (
  cityPolygons: FeatureCollection[]
): Feature<Polygon | MultiPolygon> => {
  const cityPolygonFeatures = cityPolygons.reduce((acc, cityPolygon) => {
    acc.push(
      ...cityPolygon.features.filter(
        (f) =>
          f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
      )
    );
    return acc;
  }, []);

  return cityPolygonFeatures.length > 1
    ? union(featureCollection(cityPolygonFeatures))
    : cityPolygonFeatures[0];
};
