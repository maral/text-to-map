var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createReadStream, createWriteStream, existsSync, rmSync } from "fs";
import fetch from "node-fetch";
import { join } from "path";
import sax from "sax";
import { pipeline } from "stream/promises";
import { insertFounders } from "../db/founders";
import { insertSchools } from "../db/schools";
import { MunicipalityType, SyncPart } from "../db/types";
import { prepareOptions, } from "../utils/helpers";
import { runSyncPart } from "./common";
const downloadXml = (options) => __awaiter(void 0, void 0, void 0, function* () {
    if (existsSync(getXmlFilePath(options))) {
        return;
    }
    console.log("Downloading a large XML file with school data...");
    const response = yield fetch(options.schoolsXmlUrl);
    if (response.status !== 200) {
        throw new Error(`The XML file could not be downloaded. HTTP Code: ${response.status}`);
    }
    yield pipeline(response.body, createWriteStream(getXmlFilePath(options)));
    console.log("Finished downloading.");
});
var XMLState;
(function (XMLState) {
    XMLState[XMLState["None"] = 0] = "None";
    XMLState[XMLState["RedIzo"] = 1] = "RedIzo";
    XMLState[XMLState["SchoolName"] = 2] = "SchoolName";
    XMLState[XMLState["Izo"] = 3] = "Izo";
    XMLState[XMLState["Ico"] = 4] = "Ico";
    XMLState[XMLState["SchoolType"] = 5] = "SchoolType";
    XMLState[XMLState["Capacity"] = 6] = "Capacity";
    XMLState[XMLState["RuianCode"] = 7] = "RuianCode";
    XMLState[XMLState["Address"] = 8] = "Address";
    XMLState[XMLState["FounderName"] = 9] = "FounderName";
    XMLState[XMLState["FounderType"] = 10] = "FounderType";
    XMLState[XMLState["FounderIco"] = 11] = "FounderIco";
})(XMLState || (XMLState = {}));
const SCHOOL_TYPE_PRIMARY = "B00";
const createNewSchool = () => {
    return {
        name: "",
        redizo: "",
        izo: "",
        capacity: 0,
        locations: [],
    };
};
const getCorrectFounderType = (founderType) => {
    return founderType === "" ? "101" : founderType;
};
const getMunicipalityType = (founderType) => {
    return founderType === "261"
        ? MunicipalityType.City
        : founderType === "263"
            ? MunicipalityType.District
            : MunicipalityType.Other;
};
const processSchoolRegisterXml = (options) => __awaiter(void 0, void 0, void 0, function* () {
    let currentSchool;
    let isCurrentSchoolPrimary;
    let currentIzo;
    let currentIco;
    let currentType;
    let currentCapacity;
    let currentLocations = [];
    let state = XMLState.None;
    let currentFounders = [];
    let currentFounderIco;
    let currentFounderName;
    let currentFounderType;
    let isRuianCodeSet = false;
    let isRuianCodeMissing = false;
    let currentAddress = [];
    const founders = new Map();
    const schools = [];
    const schoolsWithoutRuian = [];
    const streamPromise = new Promise((resolve, reject) => {
        const saxStream = sax
            .createStream(true)
            .on("opentag", (tag) => {
            switch (tag.name) {
                case "PravniSubjekt":
                    currentSchool = createNewSchool();
                    isCurrentSchoolPrimary = false;
                    isRuianCodeMissing = false;
                    break;
                case "RedIzo":
                    state = XMLState.RedIzo;
                    break;
                case "RedPlnyNazev":
                    state = XMLState.SchoolName;
                    break;
                case "IZO":
                    state = XMLState.Izo;
                    break;
                case "ICO":
                    state = XMLState.Ico;
                    break;
                case "SkolaDruhTyp":
                    state = XMLState.SchoolType;
                    break;
                case "SkolaKapacita":
                    state = XMLState.Capacity;
                    break;
                case "MistoRUAINKod":
                    isRuianCodeSet = false;
                    currentAddress = [];
                    state = XMLState.RuianCode;
                    break;
                case "ZrizNazev":
                    state = XMLState.FounderName;
                    break;
                case "ZrizPravniForma":
                    state = XMLState.FounderType;
                    break;
                case "MistoAdresa1":
                case "MistoAdresa2":
                case "MistoAdresa3":
                    state = XMLState.Address;
                    break;
                case "ZrizDatumNarozeni":
                case "ZrizICO":
                    state = XMLState.FounderIco;
                    break;
            }
        })
            .on("closetag", (tagName) => {
            switch (tagName) {
                case "PravniSubjekt":
                    if (isCurrentSchoolPrimary) {
                        schools.push(currentSchool);
                        currentFounders.forEach((founder) => {
                            const key = founder.name + founder.ico;
                            if (founders.has(key)) {
                                founders.get(key).schools.push(currentSchool);
                            }
                            else {
                                founders.set(key, {
                                    name: founder.name,
                                    ico: founder.ico,
                                    originalType: founder.type,
                                    municipalityType: getMunicipalityType(founder.type),
                                    schools: [currentSchool],
                                });
                            }
                        });
                    }
                    currentIco = "";
                    currentFounders = [];
                    break;
                case "Zrizovatel":
                    if (currentFounderIco === "" || currentFounderName === "") {
                        currentFounders.push({
                            ico: currentIco,
                            name: currentSchool.name,
                            type: "224", // s.r.o (not all are those, but we don't need to differentiate here)
                        });
                    }
                    else {
                        currentFounders.push({
                            ico: currentFounderIco,
                            name: currentFounderName,
                            type: getCorrectFounderType(currentFounderType),
                        });
                    }
                    currentFounderIco = "";
                    currentFounderName = "";
                    currentFounderType = "";
                    break;
                case "SkolaZarizeni":
                    if (currentType === SCHOOL_TYPE_PRIMARY) {
                        currentSchool.izo = currentIzo;
                        currentSchool.locations = currentLocations;
                        currentSchool.capacity = currentCapacity;
                    }
                    currentLocations = [];
                    break;
                case "SkolaMistoVykonuCinnosti":
                    if (isRuianCodeMissing) {
                        schoolsWithoutRuian.push({
                            izo: currentIzo,
                            address: currentAddress,
                            isPrimary: currentType === SCHOOL_TYPE_PRIMARY,
                        });
                    }
                    break;
                case "MistoRUAINKod":
                    isRuianCodeMissing = !isRuianCodeSet;
                case "RedPlnyNazev":
                case "RedIzo":
                case "ICO":
                case "IZO":
                case "SkolaDruhTyp":
                case "SkolaKapacita":
                case "ZrizNazev":
                case "ZrizICO":
                case "ZrizDatumNarozeni":
                case "ZrizPravniForma":
                case "MistoAdresa1":
                case "MistoAdresa2":
                case "MistoAdresa3":
                    state = XMLState.None;
                    break;
            }
        })
            .on("text", (text) => {
            switch (state) {
                case XMLState.RedIzo:
                    currentSchool.redizo = text;
                case XMLState.SchoolName:
                    currentSchool.name = text;
                    break;
                case XMLState.Izo:
                    currentIzo = text;
                    break;
                case XMLState.Ico:
                    currentIco = text;
                    break;
                case XMLState.SchoolType:
                    currentType = text;
                    if (text === SCHOOL_TYPE_PRIMARY) {
                        isCurrentSchoolPrimary = true;
                    }
                    break;
                case XMLState.RuianCode:
                    isRuianCodeSet = true;
                    currentLocations.push({
                        addressPointId: parseInt(text),
                    });
                    break;
                case XMLState.Address:
                    currentAddress.push(text);
                    break;
                case XMLState.FounderName:
                    currentFounderName = text;
                    break;
                case XMLState.FounderIco:
                    currentFounderIco = text;
                    break;
                case XMLState.FounderType:
                    currentFounderType = text;
                    break;
                case XMLState.Capacity:
                    currentCapacity = parseInt(text);
                    break;
            }
        })
            .on("error", reject)
            .on("end", resolve);
        // wanted to use 'await pipeline(createReadStream(getXmlFilePath(options)), saxStream)'
        // but the program would quit spontaneously after finishing stream - using Promise instead.
        createReadStream(getXmlFilePath(options)).pipe(saxStream);
    });
    yield streamPromise;
    return { schools, founders, schoolsWithoutRuian };
});
const importDataToDb = (options, saveFoundersToCsv = false, saveSchoolsWithoutRuianToCsv = false) => __awaiter(void 0, void 0, void 0, function* () {
    const { schools, founders, schoolsWithoutRuian } = yield processSchoolRegisterXml(options);
    if (saveFoundersToCsv) {
        const csvFile = "founders.csv";
        if (existsSync(csvFile)) {
            rmSync(csvFile);
        }
        var csv = createWriteStream(csvFile, {
            flags: "a",
        });
        csv.write("IČO;Zřizovatel;Právní forma;Počet škol;Školy\n");
        founders.forEach((founder) => {
            csv.write(`#${founder.ico};${founder.name};${founder.originalType};${founder.schools.length};${founder.schools.map((school) => school.name).join("---")}\n`);
        });
        csv.end();
    }
    if (saveSchoolsWithoutRuianToCsv) {
        const csvFile = "schoolsWithoutRuian.csv";
        if (existsSync(csvFile)) {
            rmSync(csvFile);
        }
        var csv = createWriteStream(csvFile, {
            flags: "a",
        });
        csv.write("IZO;Je základní;adresa1;adresa2;adresa3\n");
        schoolsWithoutRuian.forEach((schoolAddress) => {
            csv.write(`#${schoolAddress.izo};${schoolAddress.isPrimary ? "TRUE" : "FALSE"};${schoolAddress.address.join(";")}\n`);
        });
        csv.end();
    }
    yield insertSchools(schools);
    yield insertFounders(Array.from(founders.values()));
});
const getXmlFilePath = (options) => {
    return join(options.tmpDir, options.schoolsXmlFileName);
};
export const downloadAndImportSchools = (options, saveFoundersToCsv = false, saveSchoolsWithoutRuianToCsv = false) => __awaiter(void 0, void 0, void 0, function* () {
    yield runSyncPart(SyncPart.Schools, [SyncPart.AddressPoints], () => __awaiter(void 0, void 0, void 0, function* () {
        const runOptions = prepareOptions(options);
        yield downloadXml(runOptions);
        yield importDataToDb(runOptions, saveFoundersToCsv, saveSchoolsWithoutRuianToCsv);
        deleteSchoolsXmlFile(runOptions);
    }));
});
export const deleteSchoolsXmlFile = (options = {}) => {
    const runOptions = prepareOptions(options);
    if (existsSync(getXmlFilePath(runOptions))) {
        rmSync(getXmlFilePath(runOptions));
    }
};
