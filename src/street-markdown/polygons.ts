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
  let colorIndex = 0;
  for (const school of municipality.schools) {
    const schoolPolygons = polygons.features.filter((polygon) =>
      polygon.properties.schools.includes(school.izo)
    );

    // let schoolPolygon: Feature;

    // const polygonMap = new Map<
    //   number,
    //   Feature<Polygon | MultiPolygon, PolygonProps>
    // >();

    // for (const polygon of schoolPolygons) {
    //   polygonMap.set(polygon.properties.index, polygon);
    // }

    // TODO: coloring of polygons
    // - just take note of all the school IZOs in the neighboring polygons
    // - create a graph
    // - color the graph (using some library)
    // - do not give an exact color, just an index of the color

    // How this works:
    // - take a next polygon of this school from `polygonMap`
    // - go through `neighbors` set, one by one
    //   - if the neighbor doesn't belong to the school, skip it
    //   - if it belongs, add it to `polygonsToUnion` + add all its new neigbors to the `neighbors` set
    //   - in both cases, remove the neighbor from both `neighbors` set and `polygonMap`
    // - after no neighbors remain, create a union of all the polygons
    // - merge the resulting united polygon into `schoolPolygon`
    // - when all polygons were

    // while (polygonMap.size > 0) {
    //   const key = polygonMap.keys().next().value;
    //   const polygon = polygonMap.get(key);
    //   const polygonsToUnion = [polygon];
    //   const keys = new Set<number>([key]);
    //   const otherKeys = new Set<number>();
    //   polygonMap.delete(key);
    //   const neighbors = new Set(polygon.properties.neighbors);
    //   while (neighbors.size > 0) {
    //     const neighborKey = neighbors.values().next().value;
    //     neighbors.delete(neighborKey);

    //     // neighbor is the polygon itself or is not in polygonMap
    //     if (!polygonMap.has(neighborKey)) {
    //       otherKeys.add(neighborKey);
    //       continue;
    //     }

    //     keys.add(neighborKey);
    //     const neighborPolygon = polygonMap.get(neighborKey);
    //     polygonMap.delete(neighborKey);
    //     polygonsToUnion.push(neighborPolygon);
    //     neighborPolygon.properties.neighbors.forEach((neighbor) => {
    //       if (!keys.has(neighbor) && !otherKeys.has(neighbor)) {
    //         neighbors.add(neighbor);
    //       }
    //     });
    //   }
    //   const intersection = intersect(
    //     polygonsToUnion.length > 1
    //       ? union(featureCollection(polygonsToUnion))
    //       : polygonsToUnion[0],
    //     citiesMultipolygon
    //   );
    //   if (!intersection) {
    //     throw new Error("Polygon does not intersect with city borders");
    //   }
    //   const result = {
    //     ...intersection,
    //     properties: {
    //       schoolIzo: school.izo,
    //       colorIndex,
    //     },
    //   };

    //   if (!schoolPolygon) {
    //     schoolPolygon = result;
    //   } else {
    //     schoolPolygon = union(featureCollection([schoolPolygon, result]));
    //   }
    // }

    const schoolPolygon = intersect(
      schoolPolygons.length > 1
        ? union(featureCollection(schoolPolygons))
        : schoolPolygons[0],
      citiesMultipolygon
    );

    unitedPolygons.push({
      ...schoolPolygon,
      properties: {
        schoolIzo: school.izo,
        colorIndex,
      },
    });
    colorIndex++;
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
