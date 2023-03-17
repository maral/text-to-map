import { resolve } from "path";
import { writeFileSync } from "fs";
import { createSyntaxDiagramsCode } from "chevrotain";
import { smdParser } from "../street-markdown/smd-line-parser";

// extract the serialized grammar.
const serializedGrammar = smdParser.getSerializedGastProductions();

// create the HTML Text
const htmlText = createSyntaxDiagramsCode(serializedGrammar);

// Write the HTML file to disk
writeFileSync("generated_diagrams.html", htmlText);
