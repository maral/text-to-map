const lex = require("./step1_lexing").lex;

const inputText = "Názovská - lichá č. 12-15";
const lexingResult = lex(inputText);
console.log(JSON.stringify(lexingResult, null, "\t"));
