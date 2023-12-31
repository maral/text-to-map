import { Delaunay } from "d3-delaunay";
import { Municipality } from "./types";

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import {
  Feature,
  FeatureCollection,
  Point,
  Polygon,
  featureCollection,
} from "@turf/helpers";
import { toMercator, toWgs84 } from "@turf/projection";
import union from "@turf/union";
import voronoi from "@turf/voronoi";

type PolygonProps = {
  schools: string[];
  index: number;
  neighbors: Set<number>;
};

export const municipalityToPolygons = (municipality: Municipality) => {
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
  // const polygons = turfVoronoi(points);

  const unitedPolygons: Feature[] = [];
  for (const school of municipality.schools) {
    const schoolPolygons = polygons.features.filter((polygon) =>
      polygon.properties.schools.includes(school.izo)
    );

    const polygonMap = new Map<number, Feature<Polygon, PolygonProps>>();

    for (const polygon of schoolPolygons) {
      polygonMap.set(polygon.properties.index, polygon);
    }

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
        ) as Feature<Polygon, PolygonProps>;
        neighborPolygon.properties.neighbors.forEach((neighbor) => {
          neighbors.add(neighbor);
        });
      }
      polygon.properties.schools = [school.izo];
      unitedPolygons.push(polygon);
    }
  }

  const { type } = polygons;
  return {
    type,
    features: [...unitedPolygons, ...points.features],
  };
};

function countPointsInPolygon(
  polygon: Polygon,
  points: FeatureCollection<Point>
): number {
  return points.features.filter((point) =>
    booleanPointInPolygon(point.geometry, polygon)
  ).length;
}

function d3DelaunayVoronoi(
  points: FeatureCollection<Point>
): FeatureCollection<Polygon, PolygonProps> {
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
}

function turfVoronoi(points: FeatureCollection<Point>) {
  const pointsMercator = toMercator(points);
  const pointsBbox = [...toMercator([-180, -85]), ...toMercator([180, 85])] as [
    number,
    number,
    number,
    number
  ];
  const result = voronoi(pointsMercator, { bbox: pointsBbox });
  const polygons = {
    ...result,
    features: result.features
      .map((feature, i) => ({
        ...feature,
        geometry: toWgs84(feature.geometry),
        properties: points.features[i].properties,
      }))
      .filter((feature) => feature !== null),
  };

  return polygons;
}
