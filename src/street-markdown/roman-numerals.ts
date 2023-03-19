let romanNumerals: string[];
const singleRomanNumeralPattern =
  /X{1,3}(IX|IV|V?I{0,3})|(IX|IV|VI{0,3})|(I{1,3})/g;
const romanNumeralsListPattern =
  /(X{1,3}(IX|IV|V?I{0,3})|(IX|IV|VI{0,3})|(I{1,3}))(, ?(X{1,3}(IX|IV|V?I{0,3})|(IX|IV|VI{0,3})|(I{1,3})))+$/;
const romanNumeralsRangePattern = /([IVXLCDM]+) ?- ?([IVXLCDM]+)$/;
export const splitStreetViaRomanNumerals = (input: string): string[] => {
  const list = romanNumeralsListPattern.exec(input);
  if (list) {
    const streetName = input.substring(0, input.indexOf(list[0])).trim();
    return extractRomanNumerals(list[0]).map(
      (numeral) => `${streetName} ${numeral}`
    );
  } else {
    const range = romanNumeralsRangePattern.exec(input);
    if (range) {
      const streetName = input.substring(0, input.indexOf(range[0])).trim();
      const bounds = extractRomanNumerals(range[0]);
      if (!romanNumerals) {
        romanNumerals = generateRomanNumerals(100);
      }
      return romanNumerals
        .slice(
          romanNumerals.indexOf(bounds[0]),
          romanNumerals.indexOf(bounds[1]) + 1
        )
        .map((numeral) => `${streetName} ${numeral}`);
    }
  }
  return [input];
};

const extractRomanNumerals = (input: string): string[] => {
  let n: RegExpExecArray | null;
  const numerals = [];
  do {
    n = singleRomanNumeralPattern.exec(input);
    if (n) {
      numerals.push(n[0]);
    }
  } while (n);
  return numerals;
};

// source: ChatGPT
const generateRomanNumerals = (n: number) => {
  const romanNumerals = [];
  const romanNumeralsMap = new Map([
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ]);

  for (let i = 1; i <= n; i++) {
    let number = i;
    let romanNumeral = "";
    for (const [value, symbol] of romanNumeralsMap) {
      while (number >= value) {
        number -= value;
        romanNumeral += symbol;
      }
    }
    romanNumerals.push(romanNumeral);
  }

  return romanNumerals;
};
