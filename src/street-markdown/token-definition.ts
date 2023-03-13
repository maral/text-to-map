import { createToken, Lexer, TokenVocabulary } from "chevrotain";

const MainSeparator = createToken({ name: "MainSeparator", pattern: / - / });
const From = createToken({ name: "From", pattern: /od/ });
const AndAbove = createToken({ name: "AndAbove", pattern: / (a )?výše/ });
const Separator = createToken({
  name: "Separator",
  pattern: /,| a /,
  longer_alt: [AndAbove],
});
const StreetName = createToken({
  name: "StreetName",
  pattern: /[^\n -]+([ -]?[^\n -]+)*/,
});
const OddType = createToken({ name: "OddType", pattern: /lichá č./ });
const EvenType = createToken({ name: "EvenType", pattern: /sudá č./ });
const DescriptiveType = createToken({ name: "CPType", pattern: /č. ?p./ });
const AllType = createToken({
  name: "AllType",
  pattern: /č./,
  longer_alt: DescriptiveType,
});

const Number = createToken({ name: "Number", pattern: /\d+[a-zA-Z]?/ });
const Hyphen = createToken({ name: "Hyphen", pattern: /-/ });
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
  AndAbove,
  Hyphen,
  Space,
  StreetName,
];

MainSeparator.LABEL = "' - '";
Separator.LABEL = "','";
Hyphen.LABEL = "'-'";
From.LABEL = "'od'";
AndAbove.LABEL = "'a výše'";
Space.LABEL = "' '";
OddType.LABEL = "'lichá č.'";
EvenType.LABEL = "'sudá č.'";
DescriptiveType.LABEL = "'č. p.'";
AllType.LABEL = "'č.'";

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
  AndAbove,
  Hyphen,
  Space,
  StreetName,
  smdTokens,
  tokenVocabulary,
};
