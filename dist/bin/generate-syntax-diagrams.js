import { writeFileSync } from "fs";
import { createSyntaxDiagramsCode } from "chevrotain";
import { smdParser } from "../street-markdown/smd-line-parser";
// extract the serialized grammar.
const serializedGrammar = smdParser.getSerializedGastProductions();
// create the HTML Text
const htmlText = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SMD street line Syntax Diagrams</title>
</head>
<body>
${createSyntaxDiagramsCode(serializedGrammar)}
</body>
</html>`;
// Write the HTML file to disk
writeFileSync("generated_diagrams.html", htmlText);
