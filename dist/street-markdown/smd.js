var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { checkStreetExists, findAddressPoints, getAddressPointById, } from "../db/address-points";
import { disconnectKnex } from "../db/db";
import { findFounder, getFounderById } from "../db/founders";
import { findSchool } from "../db/schools";
import { founderToMunicipality } from "../db/types";
import { getMunicipalityPartResult, getRestOfMunicipalityPart, getSwitchMunicipality, getWholeMunicipality, isMunicipalitySwitch, isRestOfMunicipalityLine, isRestOfMunicipalityPartLine, isRestWithNoStreetNameLine, isWholeMunicipality, } from "./municipality";
import { parseLine } from "./smd-line-parser";
import { isAddressPoint, } from "./types";
export const parseOrdinanceToAddressPoints = (lines, initialState = {}, onError = () => { }, onWarning = () => { }, onProcessedLine = () => { }) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const state = Object.assign({ currentMunicipality: null, currentFilterMunicipality: null, currentSchool: null, rests: {
                noStreetNameSchoolIzo: null,
                municipalityParts: [],
                wholeMunicipalitySchoolIzo: null,
            }, municipalities: [] }, initialState);
        let lineNumber = 1;
        for (const rawLine of lines) {
            const line = cleanLine(rawLine);
            yield processOneLine({
                line,
                state,
                lineNumber,
                onError,
                onWarning,
            });
            onProcessedLine({ lineNumber, line });
            lineNumber++;
        }
        if (state.currentSchool != null) {
            if (state.currentMunicipality == null) {
                return [];
            }
            state.currentMunicipality.schools.push(mapSchoolForExport(state.currentSchool));
        }
        yield completeCurrentMunicipality(state);
        return state.municipalities;
    }
    catch (error) {
        console.error(error);
    }
    finally {
        yield disconnectKnex();
    }
});
const filterOutSchoolAddressPoint = (addressPoints, school) => {
    const schoolPosition = school.position;
    return schoolPosition && isAddressPoint(schoolPosition)
        ? (addressPoints = addressPoints.filter((ap) => ap.id !== schoolPosition.id))
        : addressPoints;
};
export const convertMunicipality = (municipality) => {
    return {
        municipalityName: municipality.municipalityName,
        schools: municipality.schools,
    };
};
const processOneLine = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { line, state } = params;
    if (line[0] === "#") {
        yield processMunicipalityLine(params);
        return;
    }
    if (line === "") {
        // end of school
        processEmptyLine(params);
        return;
    }
    if (line[0] === "!") {
        return;
    }
    if (state.currentSchool === null) {
        yield processSchoolLine(params);
        return;
    }
    if (isMunicipalitySwitch(line)) {
        processMunicipalitySwitchLine(params);
    }
    else if (isWholeMunicipality(line)) {
        yield processWholeMunicipalityLine(params);
    }
    else if (isRestWithNoStreetNameLine(line)) {
        state.rests.noStreetNameSchoolIzo = state.currentSchool.izo;
    }
    else if (isRestOfMunicipalityLine(line)) {
        state.rests.wholeMunicipalitySchoolIzo = state.currentSchool.izo;
    }
    else if (isRestOfMunicipalityPartLine(line)) {
        const { municipalityPartCode, errors } = yield getRestOfMunicipalityPart(line, state.currentMunicipality.founder);
        if (errors.length > 0) {
            params.onError({ lineNumber: params.lineNumber, line, errors });
        }
        else {
            state.rests.municipalityParts.push({
                municipalityPartCode,
                schoolIzo: state.currentSchool.izo,
            });
        }
    }
    else {
        yield processAddressPointLine(params);
    }
});
const processMunicipalityLine = ({ line, lineNumber, state, onError, }) => __awaiter(void 0, void 0, void 0, function* () {
    if (state.currentSchool !== null) {
        state.currentMunicipality.schools.push(state.currentSchool);
        state.currentSchool = null;
    }
    yield completeCurrentMunicipality(state);
    const { municipality, errors } = yield getNewMunicipalityByName(line);
    if (errors.length > 0) {
        onError({ lineNumber, line, errors });
    }
    state.currentMunicipality = municipality;
    state.currentFilterMunicipality = founderToMunicipality(state.currentMunicipality.founder);
    state.currentSchool = null;
});
const completeCurrentMunicipality = (state) => __awaiter(void 0, void 0, void 0, function* () {
    if (state.currentMunicipality !== null) {
        yield addRests(state);
        state.municipalities.push(convertMunicipality(state.currentMunicipality));
    }
});
const processEmptyLine = ({ state }) => {
    if (state.currentSchool !== null) {
        state.currentMunicipality.schools.push(state.currentSchool);
        state.currentSchool = null;
    }
};
const processSchoolLine = ({ line, lineNumber, state, onError, }) => __awaiter(void 0, void 0, void 0, function* () {
    if (state.currentMunicipality === null) {
        onError({
            lineNumber,
            line,
            errors: [
                wholeLineError("Definici školy musí předcházet definice zřizovatele (uvozená '#', např. '# Strakonice').", line),
            ],
        });
        return;
    }
    state.currentSchool = yield getNewSchool(line, state.currentMunicipality.founder, lineNumber, onError);
    state.currentFilterMunicipality = founderToMunicipality(state.currentMunicipality.founder);
});
const processMunicipalitySwitchLine = ({ line, state, lineNumber, onError, }) => __awaiter(void 0, void 0, void 0, function* () {
    const { municipality, errors } = yield getSwitchMunicipality(line, state.currentMunicipality.founder);
    if (errors.length > 0) {
        onError({ lineNumber, line, errors });
    }
    else {
        state.currentFilterMunicipality = municipality;
    }
});
const processWholeMunicipalityLine = ({ line, state, lineNumber, onError, }) => __awaiter(void 0, void 0, void 0, function* () {
    const { municipality, errors } = yield getWholeMunicipality(line, state.currentMunicipality.founder);
    if (errors.length > 0) {
        onError({ lineNumber, line, errors });
    }
    else {
        const addressPoints = yield findAddressPoints({
            type: "wholeMunicipality",
            municipality,
        });
        state.currentSchool.addresses.push(...filterOutSchoolAddressPoint(addressPoints, state.currentSchool).map(mapAddressPointForExport));
    }
});
const processAddressPointLine = ({ line, state, lineNumber, onError, onWarning, }) => __awaiter(void 0, void 0, void 0, function* () {
    const { smdLines, errors } = parseLine(line);
    if (errors.length > 0) {
        onError({ lineNumber, line, errors });
    }
    else {
        for (const smdLine of smdLines) {
            if (smdLine.type === "street") {
                const { exists, errors } = yield checkStreetExists(smdLine.street, state.currentMunicipality.founder);
                if (errors.length > 0) {
                    onWarning({ lineNumber, line, errors });
                }
                if (exists) {
                    const addressPoints = yield findAddressPoints({
                        type: "smdLine",
                        smdLine,
                        municipality: state.currentFilterMunicipality,
                    });
                    state.currentSchool.addresses.push(...filterOutSchoolAddressPoint(addressPoints, state.currentSchool).map(mapAddressPointForExport));
                }
            }
            else if (smdLine.type === "municipalityPart") {
                const { municipalityPartCode, errors } = yield getMunicipalityPartResult(smdLine.municipalityPart, line, state.currentMunicipality.founder);
                if (errors.length > 0) {
                    onWarning({ lineNumber, line, errors });
                }
                else {
                    const addressPoints = yield findAddressPoints({
                        type: "smdLine",
                        smdLine,
                        municipality: state.currentFilterMunicipality,
                        municipalityPartCode,
                    });
                    state.currentSchool.addresses.push(...filterOutSchoolAddressPoint(addressPoints, state.currentSchool).map(mapAddressPointForExport));
                }
            }
        }
    }
});
const addRestToSchool = (restPoints, schoolIzo, state) => __awaiter(void 0, void 0, void 0, function* () {
    const addressPoints = state.currentMunicipality.schools.flatMap((school) => school.addresses);
    // filter out address points already present
    const remainingPoints = restPoints.filter((point) => !addressPoints.some((ap) => ap.address === point.address));
    // find the right school and add the remaining address points
    const schoolIndex = state.currentMunicipality.schools.findIndex((school) => school.izo === schoolIzo);
    state.currentMunicipality.schools[schoolIndex].addresses.push(...remainingPoints);
});
const addRests = (state) => __awaiter(void 0, void 0, void 0, function* () {
    if (state.rests.noStreetNameSchoolIzo) {
        yield addRestWithNoStreetNameToSchool(state);
    }
    if (state.rests.wholeMunicipalitySchoolIzo) {
        yield addRestOfMunicipality(state);
    }
    for (const rest of state.rests.municipalityParts) {
        yield addRestOfMunicipalityPart(state, rest.municipalityPartCode, rest.schoolIzo);
    }
    state.rests.noStreetNameSchoolIzo = null;
    state.rests.wholeMunicipalitySchoolIzo = null;
    state.rests.municipalityParts = [];
});
const addRestWithNoStreetNameToSchool = (state) => __awaiter(void 0, void 0, void 0, function* () {
    // get all address points without street name for current municipality
    const pointsNoStreetName = yield findAddressPoints({
        type: "wholeMunicipalityNoStreetName",
        municipality: {
            code: state.currentMunicipality.founder.cityOrDistrictCode,
            type: state.currentMunicipality.founder.municipalityType,
        },
    });
    yield addRestToSchool(pointsNoStreetName, state.rests.noStreetNameSchoolIzo, state);
});
const addRestOfMunicipality = (state) => __awaiter(void 0, void 0, void 0, function* () {
    // get all address points for current municipality
    const allPoints = yield findAddressPoints({
        type: "wholeMunicipality",
        municipality: {
            code: state.currentMunicipality.founder.cityOrDistrictCode,
            type: state.currentMunicipality.founder.municipalityType,
        },
    });
    yield addRestToSchool(allPoints, state.rests.wholeMunicipalitySchoolIzo, state);
});
const addRestOfMunicipalityPart = (state, municipalityPartCode, schoolIzo) => __awaiter(void 0, void 0, void 0, function* () {
    // get all address points for current municipality
    const allPoints = yield findAddressPoints({
        type: "wholeMunicipalityPart",
        municipalityPartCode,
    });
    yield addRestToSchool(allPoints, schoolIzo, state);
});
export const getNewMunicipalityByName = (name) => __awaiter(void 0, void 0, void 0, function* () {
    const { founder, errors } = yield findFounder(name);
    return getNewMunicipality(founder, errors);
});
export const getNewMunicipalityByFounderId = (founderId) => __awaiter(void 0, void 0, void 0, function* () {
    const { founder, errors } = yield getFounderById(founderId);
    return getNewMunicipality(founder, errors);
});
const getNewMunicipality = (founder, errors) => ({
    municipality: {
        municipalityName: founder ? founder.name : "Neznámá obec",
        founder,
        schools: [],
    },
    errors,
});
export const getNewSchool = (name, founder, lineNumber, onError) => __awaiter(void 0, void 0, void 0, function* () {
    let exportSchool = {
        name,
        izo: "",
        addresses: [],
    };
    if (founder !== null) {
        const { school, errors } = findSchool(name, founder.schools);
        if (errors.length > 0) {
            onError({ lineNumber, line: name, errors });
        }
        if (school) {
            exportSchool.name = school.name;
            exportSchool.izo = school.izo || "";
            if (school.locations.length > 0) {
                const position = yield getAddressPointById(school.locations[0].addressPointId);
                if (position !== null) {
                    exportSchool.position = position;
                }
            }
        }
    }
    return exportSchool;
});
const mapAddressPointForExport = (addressPoint) => {
    return {
        address: addressPoint.address,
        lat: addressPoint.lat,
        lng: addressPoint.lng,
    };
};
const mapSchoolForExport = (school) => ({
    name: school.name,
    izo: school.izo,
    addresses: school.addresses,
    position: school.position ? mapAddressPointForExport(school.position) : null,
});
const cleanLine = (line) => {
    return line.trim().replace(/–/g, "-");
};
export const wholeLineError = (message, line) => ({
    message,
    startOffset: 0,
    endOffset: line.length + 1,
});
