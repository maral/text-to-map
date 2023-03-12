import { createToken, Lexer, TokenVocabulary } from "chevrotain";

const MainSeparator = createToken({ name: "MainSeparator", pattern: / - / });
const Separator = createToken({ name: "Separator", pattern: /,| a / });
const StreetName = createToken({
  name: "StreetName",
  pattern: /[^\n -]+([ -]?[^\n -]+)*/,
});
const OddType = createToken({ name: "OddType", pattern: /lichá č./ });
const EvenType = createToken({ name: "EvenType", pattern: /sudá č./ });
const CPType = createToken({ name: "CPType", pattern: /č. ?p./ });
const AllType = createToken({
  name: "AllType",
  pattern: /č./,
  longer_alt: CPType,
});
const Number = createToken({ name: "Number", pattern: /\d+[a-zA-Z]?/ });
const NewLine = createToken({ name: "NewLine", pattern: /\n/ });
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
  CPType,
  AllType,
  Number,
  NewLine,
  Hyphen,
  Space,
  StreetName,
];

MainSeparator.LABEL = "' - '";
Separator.LABEL = "','";
Hyphen.LABEL = "'-'";
NewLine.LABEL = "'\\n'";
Space.LABEL = "' '";
OddType.LABEL = "'lichá č.'";
EvenType.LABEL = "'sudá č.'";
CPType.LABEL = "'č. p.'";
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
  CPType,
  AllType,
  Number,
  NewLine,
  Hyphen,
  Space,
  StreetName,
  smdTokens,
  tokenVocabulary,
};
