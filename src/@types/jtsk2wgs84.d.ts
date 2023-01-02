declare module "@arodax/jtsk2wgs84" {
  export interface WGS84Coords {
    jtsk_x: number;
    jtsk_y: number;
    wgs84_lat: string;
    wgs84_lon: string;
    altitude: number;
    lon: number;
    lat: number;
  }

  export default function jtsk2wgs84(
    x: number,
    y: number,
    h?: number
  ): WGS84Coords;
}
