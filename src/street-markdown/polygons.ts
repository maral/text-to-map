import { Delaunay } from "d3-delaunay";
import { ExportAddressPoint, Municipality } from "./types";

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
import truncate from "@turf/truncate";

type PolygonProps = {
  schools: string[];
  index: number;
  neighbors: Set<number>;
};

export const municipalityToPolygons = async (
  municipality: Municipality
): Promise<FeatureCollection> => {
  const cityPolygons = await getCityPolygonGeojsons(municipality.cityCodes);
  return createPolygons(municipality, cityPolygons);
};

export const createPolygons = (
  municipality: Municipality,
  cityPolygons: Record<number, FeatureCollection<Polygon | MultiPolygon>>
): FeatureCollection => {
  const citiesMultipolygon = createCitiesMultipolygon(
    Object.values(cityPolygons)
  );
  const uniquePoints = new Map<string, Feature>();

  for (const school of municipality.schools) {
    for (const point of school.addresses) {
      if (!uniquePoints.has(point.address)) {
        addPoint(uniquePoints, point, school.izo);
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
    const schoolPolygons: Feature<Polygon | MultiPolygon>[] =
      polygons.features.filter((polygon) =>
        polygon.properties.schools.includes(school.izo)
      );

    if (school.isWholeMunicipality) {
      // TODO: in future add support for districts
      schoolPolygons.push(
        ...cityPolygons[municipality.cityOrDistrictCode].features
      );
    }

    if (schoolPolygons.length === 0) {
      continue;
    }

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
  return truncate({
    type,
    features: [...unitedPolygons],
  });
};

const addPoint = (
  uniquePoints: Map<string, Feature>,
  point: ExportAddressPoint,
  schoolIzo: string
) => {
  if (point.lat === null || point.lng === null) {
    return;
  }
  uniquePoints.set(point.address, {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [point.lng, point.lat],
    },
    properties: {
      schools: [schoolIzo],
    },
  });
};

const d3DelaunayVoronoi = (
  points: FeatureCollection<Point>
): FeatureCollection<Polygon, PolygonProps> => {
  const converted = points.features.map((p) => {
    return toMercator([p.geometry.coordinates[0], p.geometry.coordinates[1]]);
  });

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
    features: Array.from(voronoi.cellPolygons()).map((polygon) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [polygon.map((p) => toWgs84(p))],
      },
      properties: {
        schools: points.features[polygon.index].properties.schools,
        index: polygon.index,
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
