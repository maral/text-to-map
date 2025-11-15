declare module "shp-to-geojson" {
  import { FeatureCollection } from "@turf/helpers";
  import { Buffer } from "buffer";

  interface ArrayBuffersConfig {
    shpBuffer: Buffer;
    dbfBuffer?: Buffer;
  }

  interface ShpToGeoJsonConfig {
    arraybuffers: ArrayBuffersConfig;
  }

  export default class ShpToGeoJson {
    constructor(config: ShpToGeoJsonConfig);
    getGeoJson(): FeatureCollection;
  }
}