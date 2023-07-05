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
import { findFounder } from "../db/founders";
import { findSchool } from "../db/schools";
import { founderToMunicipality } from "../db/types";
import { getSwitchMunicipality, getWholeMunicipality, isMunicipalitySwitch, isWholeMunicipality, } from "./municipality";
import { parseLine } from "./smd-line-parser";
import { isAddressPoint, } from "./types";
export const parseOrdinanceToAddressPoints = (lines, initialState = {}, onError = () => { }, onWarning = () => { }, onProcessedLine = () => { }) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const state = Object.assign({ currentMunicipality: null, currentFilterMunicipality: null, currentSchool: null, municipalities: [] }, initialState);
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
        if (state.currentMunicipality != null) {
            state.municipalities.push(convertMunicipality(state.currentMunicipality));
        }
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
    else {
        yield processAddressPointLine(params);
    }
});
const processMunicipalityLine = ({ line, state, onError, }) => __awaiter(void 0, void 0, void 0, function* () {
    if (state.currentSchool !== null) {
        state.currentMunicipality.schools.push(state.currentSchool);
        state.currentSchool = null;
    }
    if (state.currentMunicipality !== null) {
        state.municipalities.push(convertMunicipality(state.currentMunicipality));
    }
    const { municipality, errors } = yield getNewMunicipality(line);
    state.currentMunicipality = municipality;
    state.currentFilterMunicipality = founderToMunicipality(state.currentMunicipality.founder);
    state.currentSchool = null;
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
    const { municipality, errors } = yield getSwitchMunicipality(line);
    if (errors.length > 0) {
        onError({ lineNumber, line, errors });
    }
    else {
        state.currentFilterMunicipality = municipality;
    }
});
const processWholeMunicipalityLine = ({ line, state, lineNumber, onError, }) => __awaiter(void 0, void 0, void 0, function* () {
    const { municipality, errors } = yield getWholeMunicipality(line);
    if (errors.length > 0) {
        onError({ lineNumber, line, errors });
    }
    else {
        const addressPoints = yield findAddressPoints({ wholeMunicipality: true, street: "", numberSpec: [] }, municipality);
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
            const { exists, errors } = yield checkStreetExists(smdLine.street, state.currentMunicipality.founder);
            if (errors.length > 0) {
                onWarning({ lineNumber, line, errors });
            }
            if (exists) {
                let addressPoints = yield findAddressPoints(smdLine, state.currentFilterMunicipality);
                state.currentSchool.addresses.push(...filterOutSchoolAddressPoint(addressPoints, state.currentSchool).map(mapAddressPointForExport));
            }
        }
    }
});
export const getNewMunicipality = (name) => __awaiter(void 0, void 0, void 0, function* () {
    const { founder, errors } = yield findFounder(name);
    return {
        municipality: {
            municipalityName: founder ? founder.name : "Neznámá obec",
            founder,
            schools: [],
        },
        errors,
    };
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
