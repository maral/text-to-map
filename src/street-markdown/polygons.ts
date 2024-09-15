import { Delaunay } from "d3-delaunay";
import { Area, ExportAddressPoint, Municipality } from "./types";

import {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
  featureCollection,
} from "@turf/helpers";
import intersect from "@turf/intersect";
import { booleanIntersects } from "@turf/boolean-intersects";
import Graph from "graphology";
import { color } from "graphology-color";
import { toMercator, toWgs84 } from "@turf/projection";
import union from "@turf/union";
import { getCityPolygons, getDistrictPolygons } from "../db/cities";
import truncate from "@turf/truncate";
import { PolygonsByCodes } from "../db/types";
import difference from "@turf/difference";

type PolygonProps = {
  areaIndexes: number[];
  index: number;
  neighbors: Set<number>;
};

export const municipalitiesToPolygons = async (
  municipalities: Municipality[]
): Promise<Record<number, FeatureCollection>> => {
  const { cityCodes, districtCodes } = extractMunicipalityCodes(municipalities);
  const cityPolygons = await getCityPolygons(cityCodes);
  const districtPolygons = await getDistrictPolygons(districtCodes);

  if (
    Object.keys(cityPolygons).length === 0 &&
    Object.keys(districtPolygons).length === 0
  ) {
    console.log("No polygons found for given municipalities.");
    return {};
  }

  // municipalityCode -> areas
  const extraAreas = getExtraAreas(municipalities);

  const collectionMap = new Map<
    number,
    FeatureCollection<Polygon | MultiPolygon>
  >();
  // areaIndex -> polygon
  const extraPolygonsMap = new Map<number, Feature<Polygon | MultiPolygon>[]>();

  for (const municipality of municipalities) {
    const { featureCollection, extraPolygons } = createPolygons(
      municipality,
      extraAreas.get(municipality.code) ?? [],
      getMunicipalityPolygons(municipality, cityPolygons, districtPolygons)
    );
    collectionMap.set(municipality.code, featureCollection);
    if (extraAreas.has(municipality.code)) {
      for (const [areaIndex, extraPolygon] of extraPolygons) {
        if (!extraPolygonsMap.has(areaIndex)) {
          extraPolygonsMap.set(areaIndex, []);
        }
        extraPolygonsMap.get(areaIndex).push(extraPolygon);
      }
    }
  }

  addExtraPolygons(collectionMap, extraPolygonsMap);

  findColoring(collectionMap);

  const result: Record<number, FeatureCollection> = {};
  for (const [municipalityCode, collection] of collectionMap) {
    result[municipalityCode] = collection;
  }
  return result;
};

const findColoring = (collectionMap: Map<number, FeatureCollection>) => {
  // here do the coloring
  // put all the features in one array
  const allFeatures = Array.from(collectionMap.values()).reduce(
    (acc, collection) => {
      acc.push(...collection.features);
      return acc;
    },
    []
  );

  const graph = new Graph();
  allFeatures.forEach((feature) => {
    graph.addNode(feature.properties.areaIndex);
  });

  for (const feature1 of allFeatures) {
    for (const feature2 of allFeatures) {
      if (
        feature1.properties.areaIndex !== feature2.properties.areaIndex &&
        booleanIntersects(feature1, feature2)
      ) {
        graph.addEdge(
          feature1.properties.areaIndex,
          feature2.properties.areaIndex
        );
      }
    }
  }

  color(graph);

  allFeatures.forEach((feature) => {
    feature.properties.colorIndex = graph.getNodeAttribute(
      feature.properties.areaIndex,
      "color"
    );
  });
};

const getExtraAreas = (municipalities: Municipality[]): Map<number, Area[]> => {
  // municipalityCode -> areas
  const extraAreas = new Map<number, Area[]>();

  for (const municipality of municipalities) {
    for (const area of municipality.areas) {
      // municipalityCode -> points
      const extraPoints = new Map<number, ExportAddressPoint[]>();
      for (const point of area.addresses) {
        if (point.municipalityCode) {
          if (!extraPoints.has(point.municipalityCode)) {
            extraPoints.set(point.municipalityCode, []);
          }

          extraPoints.get(point.municipalityCode).push(point);
        }
      }

      for (const [municipalityCode, points] of extraPoints) {
        if (!extraAreas.has(municipalityCode)) {
          extraAreas.set(municipalityCode, []);
        }

        extraAreas.get(municipalityCode).push({
          ...area,
          addresses: points,
        });
      }
    }
  }
  return extraAreas;
};

const addExtraPolygons = (
  collectionMap: Map<number, FeatureCollection<Polygon | MultiPolygon>>,
  extraPolygonsMap: Map<number, Feature<Polygon | MultiPolygon>[]>
) => {
  for (const collection of collectionMap.values()) {
    for (let i = 0; i < collection.features.length; i++) {
      const feature = collection.features[i];
      if (extraPolygonsMap.has(feature.properties.areaIndex)) {
        const polygons = extraPolygonsMap.get(feature.properties.areaIndex);
        const newPolygon = union(featureCollection([...polygons, feature]));
        const newFeature = {
          ...newPolygon,
          properties: { ...feature.properties },
        };
        collection.features[i] = newFeature;
      }
    }
  }
};

const getMunicipalityPolygons = (
  municipality: Municipality,
  cityPolygons: PolygonsByCodes,
  districtPolygons: PolygonsByCodes
): PolygonsByCodes => {
  const polygons: PolygonsByCodes = {};

  for (const cityCode of municipality.cityCodes) {
    if (cityPolygons[cityCode]) {
      polygons[cityCode] = cityPolygons[cityCode];

      if (
        municipality.municipalityType === "city" &&
        Object.keys(districtPolygons).length > 0 &&
        municipality.municipalityName !== "Brno"
      ) {
        let cityPolygon = extractPolygonFromCollection(cityPolygons[cityCode]);
        // subtract all district polygons from city polygon
        for (const [districtCode, districtPolygon] of Object.entries(
          districtPolygons
        )) {
          if (municipality.districtCodes.includes(parseInt(districtCode))) {
            continue;
          }
          cityPolygon = difference(
            featureCollection([
              cityPolygon,
              extractPolygonFromCollection(districtPolygon),
            ])
          );
        }
        polygons[cityCode] = featureCollection([cityPolygon]);
      }
    }
  }

  for (const districtCode of municipality.districtCodes) {
    if (districtPolygons[districtCode]) {
      polygons[districtCode] = districtPolygons[districtCode];
    }
  }

  return polygons;
};

export const createPolygons = (
  municipality: Municipality,
  extraAreas: Area[],
  municipalityPolygons: Record<
    number,
    FeatureCollection<Polygon | MultiPolygon>
  >
): {
  featureCollection: FeatureCollection<Polygon | MultiPolygon>;
  extraPolygons: Map<number, Feature<Polygon | MultiPolygon>>;
} => {
  const municipalitiesMultipolygon = createMunicipalitiesMultipolygon(
    Object.values(municipalityPolygons)
  );
  const uniquePoints = new Map<string, Feature>();
  const allAreas = [...municipality.areas, ...extraAreas];
  const extraAreasIndexes = new Set(extraAreas.map((area) => area.index));

  for (const area of allAreas) {
    const points = [...area.addresses];

    for (const point of points) {
      if (!uniquePoints.has(point.address)) {
        addPoint(uniquePoints, point, area.index);
      } else {
        uniquePoints.get(point.address).properties.areaIndexes.push(area.index);
      }
    }
  }

  const points = {
    type: "FeatureCollection",
    features: Array.from(uniquePoints.values()),
  } as FeatureCollection<Point>;

  const polygons = d3DelaunayVoronoi(points);

  const unitedPolygons: Feature<Polygon | MultiPolygon>[] = [];
  const extraPolygons = new Map<number, Feature<Polygon | MultiPolygon>>();
  let colorIndex = 0;

  for (const area of allAreas) {
    const schoolPolygons: Feature<Polygon | MultiPolygon>[] =
      polygons.features.filter((polygon) =>
        polygon.properties.areaIndexes.includes(area.index)
      );

    if (schoolPolygons.length === 0) {
      continue;
    }

    const schoolPolygon = intersect(
      schoolPolygons.length > 1
        ? union(featureCollection(schoolPolygons))
        : schoolPolygons[0],
      municipalitiesMultipolygon
    );

    const feature = {
      ...schoolPolygon,
      properties: {
        areaIndex: area.index,
        schoolIzos: area.schools.map((school) => school.izo),
        colorIndex,
      },
    };
    if (extraAreasIndexes.has(area.index)) {
      extraPolygons.set(area.index, feature);
    } else {
      unitedPolygons.push(feature);
    }
    colorIndex++;
  }

  return {
    featureCollection: truncate({
      type: "FeatureCollection",
      features: [...unitedPolygons],
    }),
    extraPolygons,
  };
};

const addPoint = (
  uniquePoints: Map<string, Feature>,
  point: ExportAddressPoint,
  areaIndex: number
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
      areaIndexes: [areaIndex],
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
        areaIndexes: points.features[polygon.index].properties.areaIndexes,
        index: polygon.index,
        neighbors: new Set(voronoi.neighbors(polygon.index)),
      },
    })),
  };
};

const createMunicipalitiesMultipolygon = (
  municipalityPolygons: FeatureCollection[]
): Feature<Polygon | MultiPolygon> => {
  const municipalityPolygonFeatures = municipalityPolygons.reduce(
    (acc, municipalityPolygon) => {
      acc.push(
        ...municipalityPolygon.features.filter(
          (f) =>
            f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
        )
      );
      return acc;
    },
    []
  );

  return extractPolygonFromCollection(
    featureCollection(municipalityPolygonFeatures)
  );
};

const extractMunicipalityCodes = (municipalities: Municipality[]) => {
  return municipalities.reduce(
    (acc, municipality) => {
      municipality.cityCodes.forEach((cityCode) => acc.cityCodes.add(cityCode));
      municipality.districtCodes.forEach((districtCode) =>
        acc.districtCodes.add(districtCode)
      );
      return acc;
    },
    { cityCodes: new Set<number>(), districtCodes: new Set<number>() }
  );
};

const extractPolygonFromCollection = (
  collection: FeatureCollection<Polygon | MultiPolygon>
): Feature<Polygon | MultiPolygon> =>
  collection.features.length > 1 ? union(collection) : collection.features[0];
