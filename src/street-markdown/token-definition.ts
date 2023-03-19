import { createToken, Lexer, TokenVocabulary } from "chevrotain";

let streetNameWasMatched = false;

export const resetTokenState = (): void => {
  streetNameWasMatched = false;
};

export const prepareLine = (text: string) => {
  return text
    .replace(/([IVXLCDM]+) - ([IVXLCDM]+)/, "$1-$2")
    .replace(/;/g, ",")
    .replace(/,$/, "");
};

const tokenBlockerFactory = (
  pattern: RegExp
): ((text: string, startOffset: number) => RegExpExecArray | null) => {
  const stickyPattern = new RegExp(pattern, "y");
  return (text: string, startOffset: number): RegExpExecArray | null => {
    if (streetNameWasMatched) {
      stickyPattern.lastIndex = startOffset;
      return stickyPattern.exec(text);
    } else {
      return null;
    }
  };
};

const interruptPatterns = [
  "lichá",
  "sudá",
  "č.",
  "od",
  "do",
  "pouze",
  "všechna",
  "bez",
  "vyjma",
  "mimo",
  "s výjimkou",
  "kromě",
];
const streetNamePattern = /[^ -]+([ -]?[^ -]+)*/;
export const streetNameMatcher = (
  text: string,
  startOffset: number
): RegExpExecArray | [string] | null => {
  if (streetNameWasMatched || startOffset > 0) {
    return null;
  } else {
    const result = streetNamePattern.exec(text);
    if (result !== null) {
      streetNameWasMatched = true;
      const firstIndex = interruptPatterns.reduce(
        (currentMin: number, pattern: string) => {
          const index = text.search(new RegExp(` ${pattern}( |$)`));
          return index >= 0 ? Math.min(index, currentMin) : currentMin;
        },
        Infinity
      );
      if (firstIndex < Infinity) {
        return [result[0].substring(0, firstIndex).trim()];
      }
    }
    return result;
  }
};

const MainSeparator = createToken({ name: "MainSeparator", pattern: / - / });
const From = createToken({ name: "From", pattern: /od/ });
const To = createToken({ name: "To", pattern: /do/ });
const AndAbove = createToken({
  name: "AndAbove",
  pattern: / (a )?(výše?|vyšší)/,
});
const AndBelow = createToken({
  name: "AndBelow",
  pattern: / a (níže?|nižší)/,
});
const Separator = createToken({
  name: "Separator",
  pattern: /,| a /,
  longer_alt: [AndAbove, AndBelow],
});
const DescriptiveType = createToken({
  name: "CPType",
  pattern: /(pouze |všechna )?č. ?p./,
});
const AllType = createToken({
  name: "AllType",
  pattern: /(pouze |všechna )?(č(\.|ísla)( ?o\.)?|lichá i sudá)/,
  longer_alt: DescriptiveType,
});
const OddType = createToken({
  name: "OddType",
  pattern:
    /(pouze |všechna )?(lich([áé]|ých)( č(\.|ísla))?( ?o\.)?|č(\.|ísla)( ?o\.)? lich[áé])/,
  longer_alt: AllType,
});
const EvenType = createToken({
  name: "EvenType",
  pattern:
    /(pouze |všechna )?(sud([áé]|ých)( č(\.|ísla))?( ?o\.)?|č(\.|ísla)( ?o\.)? sud[áé])/,
});
const Without = createToken({
  name: "Without",
  pattern: /bez|vyjma|mimo|s výjimkou|kromě/,
});
const StreetName = createToken({
  name: "StreetName",
  pattern: streetNameMatcher,
});

const Number = createToken({
  name: "Number",
  pattern: tokenBlockerFactory(/\d+[a-zA-Z]?/),
});
const Hyphen = createToken({ name: "Hyphen", pattern: /-|až/ });
const Slash = createToken({ name: "Hyphen", pattern: /\// });
const Space = createToken({
  name: "Space",
  pattern: / +/,
  longer_alt: [MainSeparator, Separator],
  group: Lexer.SKIPPED,
});

const smdTokens = [
  MainSeparator,
  Separator,
  OddType,
  EvenType,
  DescriptiveType,
  AllType,
  Number,
  From,
  To,
  AndAbove,
  AndBelow,
  Without,
  Hyphen,
  Slash,
  Space,
  StreetName,
];

MainSeparator.LABEL = "' - '";
Separator.LABEL = "','";
Hyphen.LABEL = "'-'";
Slash.LABEL = "'/'";
From.LABEL = "'od'";
To.LABEL = "'do'";
AndAbove.LABEL = "'a výše'";
AndBelow.LABEL = "'a níže'";
Space.LABEL = "' '";
OddType.LABEL = "'lichá č.'";
EvenType.LABEL = "'sudá č.'";
DescriptiveType.LABEL = "'č. p.'";
AllType.LABEL = "'č.'";
Without.LABEL = "'bez'";

const tokenVocabulary: TokenVocabulary = {};

smdTokens.forEach((tokenType) => {
  tokenVocabulary[tokenType.name] = tokenType;
});

export {
  MainSeparator,
  Separator,
  OddType,
  EvenType,
  DescriptiveType,
  AllType,
  Number,
  From,
  To,
  AndAbove,
  AndBelow,
  Without,
  Hyphen,
  Slash,
  Space,
  StreetName,
  smdTokens,
  tokenVocabulary,
};
