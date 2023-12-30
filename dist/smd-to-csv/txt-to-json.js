var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createReadStream } from "fs";
import { once } from "events";
import { createInterface } from "readline";
const pattern = /^([^ –,-]+([ –-][^ ,–-]+)*)( [–-] (lichá č.|sudá č.|č.|č. p.)( (\d+[a-zA-Z]? ?[–-] ?\d+[a-zA-Z]?|(od )?\d+[a-zA-Z]?( a)? výše|\d+[a-zA-Z]?)((, ?| ?a ?)(\d+[a-zA-Z]? ?[–-] ?\d+[a-zA-Z]?|(od )?\d+[a-zA-Z]?( a)? výše|\d+[a-zA-Z]?))*)?((, ?| ?a ?)(lichá č.|sudá č.|č.|č. p.)( (\d+[a-zA-Z]? ?[–-] ?\d+[a-zA-Z]?|(od )?\d+[a-zA-Z]?( a)? výše|\d+[a-zA-Z]?)((, ?| ?a ?)(\d+[a-zA-Z]? ?[–-] ?\d+[a-zA-Z]?|(od )?\d+[a-zA-Z]?( a)? výše|\d+[a-zA-Z]?))*)?)*)?$/;
function getNewDistrict(name) {
    return {
        name: name,
        schools: [],
    };
}
function getNewSchool(name) {
    return {
        name: name,
        lines: [],
    };
}
export function getParsedDistricts(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const rl = createInterface({
            input: createReadStream(filePath),
        });
        let lineNumber = 1;
        let districts = [];
        let currentDistrict = null;
        let currentSchool = null;
        rl.on("line", function (line) {
            let s = line
                .trim()
                .replace(/ +(?= )/g, "")
                .replace(/–/g, "-")
                .replace(/nábř\./g, "nábřeží")
                .replace(/Nábř\./g, "Nábřeží")
                .replace(/nám\./g, "náměstí")
                .replace(/Nám\./g, "Náměstí");
            if (s[0] == "#") {
                if (currentSchool != null) {
                    if (currentDistrict == null) {
                        currentDistrict = getNewDistrict("");
                    }
                    currentDistrict.schools.push(currentSchool);
                    currentSchool = null;
                }
                if (currentDistrict != null) {
                    districts.push(currentDistrict);
                }
                currentDistrict = getNewDistrict(s.substring(1).trim());
                currentSchool = null;
            }
            else if (s == "") {
                if (currentSchool != null) {
                    if (currentDistrict == null) {
                        currentDistrict = getNewDistrict("");
                    }
                    currentDistrict.schools.push(currentSchool);
                    currentSchool = null;
                }
            }
            else {
                if (currentSchool == null) {
                    currentSchool = getNewSchool(s);
                }
                else {
                    if (s[0] == "!") {
                        currentSchool.lines.push(s);
                    }
                    else {
                        if (pattern.test(s)) {
                            currentSchool.lines.push(s);
                        }
                        else {
                            console.error("Invalid street line on line " + lineNumber + ": " + s);
                        }
                    }
                }
            }
            lineNumber++;
        });
        rl.on("close", function () {
            if (currentSchool != null) {
                if (currentDistrict == null) {
                    currentDistrict = getNewDistrict("");
                }
                currentDistrict.schools.push(currentSchool);
            }
            if (currentDistrict != null) {
                districts.push(currentDistrict);
            }
            // console.log(JSON.stringify(districts));
        });
        yield once(rl, "close");
        return districts;
    });
}
