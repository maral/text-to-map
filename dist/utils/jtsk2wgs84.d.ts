export interface ConversionResult {
    jtsk_x: number;
    jtsk_y: number;
    lat: number;
    lon: number;
    altitude: number;
}
/**
 * Convert JTSK to WGS84 - taken from @arodax/jtsk2wgs84 package that had some
 * import issues.
 *
 * @param x
 * @param y
 * @param h
 * @return {{jtsk_x: number, jtsk_y: number, lon: number, lat: number, altitude: number}}
 */
export default function jtsk2wgs84(x: number, y: number, h?: number): ConversionResult;
