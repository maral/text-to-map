import { Delaunay } from "d3-delaunay";
import { ExportAddressPoint, Municipality, School } from "./types";

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
import { getCityPolygons, getDistrictPolygons } from "../db/cities";
import truncate from "@turf/truncate";
import { PolygonsByCodes } from "../db/types";

type PolygonProps = {
  schools: string[];
  index: number;
  neighbors: Set<number>;
};

export const municipalitiesToPolygons = async (
  municipalities: Municipality[]
): Promise<Record<number, FeatureCollection>> => {
  const { cityCodes, districtCodes } = extractMunicipalityCodes(municipalities);
  const cityPolygons = await getCityPolygons(cityCodes);
  const districtPolygons = await getDistrictPolygons(districtCodes);

  const extraSchools = new Map<number, School[]>();

  for (const municipality of municipalities) {
    for (const school of municipality.schools) {
      const extraPoints = new Map<number, ExportAddressPoint[]>();
      for (const point of school.addresses) {
        if (point.municipalityCode) {
          if (!extraPoints.has(point.municipalityCode)) {
            extraPoints.set(point.municipalityCode, []);
          }

          extraPoints.get(point.municipalityCode).push(point);
        }
      }

      for (const [municipalityCode, points] of extraPoints) {
        if (!extraSchools.has(municipalityCode)) {
          extraSchools.set(municipalityCode, []);
        }

        extraSchools.get(municipalityCode).push({
          ...school,
          addresses: points,
        });
      }
    }
  }

  const collectionMap = new Map<number, FeatureCollection>();
  // schoolIzo -> polygon
  const extraPolygonsMap = new Map<string, Feature[]>();

  for (const municipality of municipalities) {
    const { featureCollection, extraPolygons } = createPolygons(
      municipality,
      extraSchools.get(municipality.code) ?? [],
      getMunicipalityPolygons(municipality, cityPolygons, districtPolygons)
    );
    collectionMap.set(municipality.code, featureCollection);
    if (extraSchools.has(municipality.code)) {
      for (const [izo, extraPolygon] of extraPolygons) {
        if (!extraPolygonsMap.has(izo)) {
          extraPolygonsMap.set(izo, []);
        }
        extraPolygonsMap.get(izo).push(extraPolygon);
      }
    }
  }

  for (const collection of collectionMap.values()) {
    for (let i = 0; i < collection.features.length; i++) {
      const feature = collection.features[i];
      if (extraPolygonsMap.has(feature.properties.schoolIzo)) {
        const polygons = extraPolygonsMap.get(feature.properties.schoolIzo);
        const newPolygon = union(featureCollection([...polygons, feature]));
        const newFeature = {
          ...newPolygon,
          properties: { ...feature.properties },
        };
        collection.features[i] = newFeature;
      }
    }
  }

  const result: Record<number, FeatureCollection> = {};
  for (const [municipalityCode, collection] of collectionMap) {
    result[municipalityCode] = collection;
  }
  return result;
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
  extraSchools: School[],
  municipalityPolygons: Record<
    number,
    FeatureCollection<Polygon | MultiPolygon>
  >
): {
  featureCollection: FeatureCollection;
  extraPolygons: Map<string, Feature>;
} => {
  const municipalitiesMultipolygon = createMunicipalitiesMultipolygon(
    Object.values(municipalityPolygons)
  );
  const uniquePoints = new Map<string, Feature>();
  const allSchools = [...municipality.schools, ...extraSchools];
  const extraSchoolIzos = new Set(extraSchools.map((school) => school.izo));

  for (const school of allSchools) {
    const points = [...school.addresses];
    if (school.isWholeMunicipality && extraSchoolIzos.size > 0) {
      points.push(...municipality.wholeMunicipalityPoints);
    }
    for (const point of points) {
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
  const extraPolygons = new Map<string, Feature>();
  let colorIndex = 0;

  for (const school of allSchools) {
    const schoolPolygons: Feature<Polygon | MultiPolygon>[] =
      polygons.features.filter((polygon) =>
        polygon.properties.schools.includes(school.izo)
      );

    if (school.isWholeMunicipality && extraSchoolIzos.size === 0) {
      schoolPolygons.push(...municipalityPolygons[municipality.code].features);
    }

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
        schoolIzo: school.izo,
        colorIndex,
      },
    };
    if (extraSchoolIzos.has(school.izo)) {
      extraPolygons.set(school.izo, feature);
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

  return municipalityPolygonFeatures.length > 1
    ? union(featureCollection(municipalityPolygonFeatures))
    : municipalityPolygonFeatures[0];
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
