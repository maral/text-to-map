declare module "parsedbf" {
  import { Buffer } from "buffer";

  /**
   * Parse a DBF file buffer with optional encoding
   * @param buffer - The DBF file buffer to parse
   * @param encoding - Optional encoding (e.g., "win1250", "utf8")
   * @returns Array of parsed records as objects
   */
  function parseDBF<T = any>(buffer: Buffer, encoding?: string): T[];

  export = parseDBF;
}