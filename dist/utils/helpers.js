import { existsSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { MunicipalityType } from "../db/types";
import { setDbConfig } from "../db/db";
import { fileURLToPath } from "url";
const appName = "text-to-map";
export const getAppDataDirPath = () => join(process.env.APPDATA ||
    (process.platform == "darwin"
        ? process.env.HOME + "/Library/Preferences"
        : process.env.HOME + "/.local/share"), appName);
export const prepareOptions = (options) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const dataDir = (_a = options.dataDir) !== null && _a !== void 0 ? _a : getAppDataDirPath();
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir);
    }
    const tmpAppDir = join(tmpdir(), appName);
    if (!existsSync(tmpAppDir)) {
        mkdirSync(tmpAppDir);
    }
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return {
        tmpDir: (_b = options.tmpDir) !== null && _b !== void 0 ? _b : tmpAppDir,
        dataDir: dataDir,
        dbFilePath: (_c = options.dbFilePath) !== null && _c !== void 0 ? _c : join(dataDir, "address_points.db"),
        dbInitFilePath: (_d = options.dbInitFilePath) !== null && _d !== void 0 ? _d : join(__dirname, "..", "address_points_init.db"),
        addressPointsAtomUrl: (_e = options.addressPointsAtomUrl) !== null && _e !== void 0 ? _e : "https://atom.cuzk.cz/RUIAN-CSV-ADR-ST/RUIAN-CSV-ADR-ST.xml",
        addressPointsZipFileName: (_f = options.addressPointsZipFileName) !== null && _f !== void 0 ? _f : "ruian_csv.zip",
        addressPointsCsvFolderName: (_g = options.addressPointsCsvFolderName) !== null && _g !== void 0 ? _g : "CSV",
        streetsAtomUrl: (_h = options.streetsAtomUrl) !== null && _h !== void 0 ? _h : "https://atom.cuzk.cz/RUIAN-OBCE-SHP/RUIAN-OBCE-SHP.xml",
        streetFolderName: (_j = options.streetZipFolderName) !== null && _j !== void 0 ? _j : "streets",
        streetDbfFileName: (_k = options.streetDbfFileName) !== null && _k !== void 0 ? _k : "UL_L.dbf",
        schoolsXmlUrl: (_l = options.schoolsXmlUrl) !== null && _l !== void 0 ? _l : "https://rejstriky.msmt.cz/opendata/vrejcelk.xml",
        schoolsXmlFileName: (_m = options.schoolsXmlFileName) !== null && _m !== void 0 ? _m : "school-register.xml",
        regionsCsvUrl: (_o = options.regionsCsvUrl) !== null && _o !== void 0 ? _o : "https://www.czso.cz/documents/10180/23208674/struktura_uzemi_cr.csv",
        regionsCsvFileName: (_p = options.regionsCsvFileName) !== null && _p !== void 0 ? _p : "struktura_uzemi_cr.csv",
    };
};
export const initDb = (options) => {
    setDbConfig({
        filePath: options.dbFilePath,
        initFilePath: options.dbInitFilePath,
    });
};
const cityPatterns = [
    /^[sS]tatutární město +(.*)$/,
    /^[oO]bec +(.*)$/,
    /^[mM]ěsto +(.*)$/,
    /^[mM]ěstys +(.*)$/,
];
const districtPatterns = [
    /^[mM]ěstská část +(.*)$/,
    /^[mM]ěstský obvod +(.*)$/,
    /^[sS]tatutární město +.*, [mM]ěstská část +(.*)$/,
    /^[sS]tatutární město +.*, [mM]ěstský obvod +(.*)$/,
];
export const extractMunicipalityName = (founder) => {
    const patterns = founder.municipalityType === MunicipalityType.City
        ? cityPatterns
        : districtPatterns;
    const correctPattern = patterns.filter((pattern) => pattern.test(founder.name));
    if (correctPattern.length > 0) {
        const result = correctPattern[0].exec(founder.name);
        if (typeof result[1] !== "undefined") {
            return result[1]
                .replace(" - ", "-")
                .replace(/\s{2,}/g, " ")
                .trim();
        }
    }
    return founder.name;
};
export const sanitizeMunicipalityName = (name) => {
    return name
        .replace(" - ", "-")
        .replace(/\s{2,}/g, " ")
        .trim();
};
export const findClosestString = (str, arr) => {
    let closestStr = "";
    let closestDistance = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < arr.length; i++) {
        const currentStr = arr[i];
        const distance = interpunctionDistance(str, currentStr);
        if (distance < closestDistance) {
            closestStr = currentStr;
            closestDistance = distance;
        }
        // exact match found, exit loop
        if (closestDistance === 0) {
            break;
        }
    }
    return closestStr;
};
const interpunctionDistance = (str1, str2) => {
    let distance = levenshteinDistance(str1, str2);
    const interpunctionMistakes = {
        a: ["á"],
        á: ["a"],
        e: ["é", "ě"],
        é: ["e", "ě"],
        ě: ["e", "é"],
        i: ["í"],
        í: ["i"],
        y: ["ý"],
        ý: ["y"],
        o: ["ó"],
        ó: ["o"],
        u: ["ú", "ů"],
        ů: ["u", "ú"],
        ú: ["u", "ů"],
        c: ["č"],
        č: ["c"],
        d: ["ď"],
        ď: ["d"],
        n: ["ň"],
        ň: ["n"],
        r: ["ř"],
        ř: ["r"],
        s: ["š"],
        š: ["s"],
        t: ["ť"],
        ť: ["t"],
        z: ["ž"],
        ž: ["z"],
    };
    const str1Chars = str1.split("");
    const str2Chars = str2.split("");
    for (let i = 0; i < str1Chars.length; i++) {
        const char1 = str1Chars[i];
        const char2 = str2Chars[i];
        if (interpunctionMistakes[char1] &&
            interpunctionMistakes[char1].includes(char2)) {
            // Subtract a penalty from the distance for interpunction mistakes
            distance -= 0.5;
        }
    }
    return distance;
};
const levenshteinDistance = (str1, str2) => {
    const matrix = Array(str2.length + 1)
        .fill(null)
        .map(() => Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i++) {
        matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
        matrix[j][0] = j;
    }
    for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
            if (str1[i - 1] === str2[j - 1]) {
                matrix[j][i] = matrix[j - 1][i - 1];
            }
            else {
                matrix[j][i] =
                    Math.min(matrix[j][i - 1], // deletion
                    matrix[j - 1][i], // insertion
                    matrix[j - 1][i - 1] // substitution
                    ) + 1;
            }
        }
    }
    return matrix[str2.length][str1.length];
};
