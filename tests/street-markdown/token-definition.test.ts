import { describe, expect, test } from "@jest/globals";
import {
  resetTokenState,
  streetNameMatcher,
} from "../../src/street-markdown/token-definition";

const getMatchedStreetName = (text: string) => {
  resetTokenState();
  const match = streetNameMatcher(text, 0);
  return match ? match[0] : null;
};

describe("token definition parsing functions", () => {
  test("street name matcher - positive examples", () => {
    expect(getMatchedStreetName("Šrobárova")).toBe("Šrobárova");
    expect(getMatchedStreetName("Šrobárova od č. 30")).toBe("Šrobárova");
    expect(getMatchedStreetName("Šrobárova lichá č. 31-37")).toBe("Šrobárova");
    expect(getMatchedStreetName("Šrobárova sudá č. 30-54")).toBe("Šrobárova");
  });

  test("street name matcher - possible interruptions", () => {
    expect(getMatchedStreetName("Národního odboje")).toBe("Národního odboje");
    expect(getMatchedStreetName("Nová všelichá")).toBe("Nová všelichá");
  });
});
