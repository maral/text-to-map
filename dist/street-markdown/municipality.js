var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { findMunicipalityByNameAndType, findMunicipalityPartByName, } from "../db/founders";
import { MunicipalityType } from "../db/types";
const municipalitySwitchStartPattern = /^navíc ulice /;
const municipalitySwitchPattern = /^navíc ulice (z )?(?<type>městské části|městského obvodu|obce|města) (?<name>.+):$/;
const wholeMunicipalityStartPattern = /^území /;
const wholeMunicipalityPattern = /^území (?<type>městské části|městského obvodu|obce|města) (?<name>.+)$/;
const restWithNoStreetNamePattern = /^všechny ostatní budovy bez názvu ulice\s*$/;
const restOfMunicipalityPattern = /^zbytek (?<type>městské části|městského obvodu|obce|města)\s*$/;
const restOfMunicipalityPartPattern = /^zbytek části (obce|města) (?<name>.+)\s*$/;
export const isMunicipalitySwitch = (line) => {
    return municipalitySwitchStartPattern.test(line);
};
export const getSwitchMunicipality = (line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const match = municipalitySwitchPattern.exec(line);
    if (match === null) {
        return {
            errors: [
                {
                    message: "Neplatný zápis pro dočasnou změnu obce v definici ulic. Správný zápis je: navíc ulice <typ> <název obce>. Např.: 'navíc ulice obce Mokrá Lhota:' (název obce musí být v 1. pádě).",
                    startOffset: 0,
                    endOffset: line.length + 1,
                },
            ],
            municipality: null,
        };
    }
    const { type, name } = match.groups;
    return yield getMunicipalityResult(type, cleanName(name), line, founder);
});
export const isWholeMunicipality = (line) => {
    return wholeMunicipalityStartPattern.test(line);
};
export const isRestWithNoStreetNameLine = (line) => {
    return restWithNoStreetNamePattern.test(line);
};
export const isRestOfMunicipalityLine = (line) => {
    return restOfMunicipalityPattern.test(line);
};
export const isRestOfMunicipalityPartLine = (line) => {
    return restOfMunicipalityPartPattern.test(line);
};
export const getRestOfMunicipalityPart = (line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const match = restOfMunicipalityPartPattern.exec(line);
    if (match === null) {
        return {
            errors: [
                {
                    message: "Neplatný zápis pro přidání zbytku části obce. Správný zápis je: zbytek části <typ> <název obce>. Např.: 'zbytek části obce Malšovice' (název části obce musí být v 1. pádě).",
                    startOffset: 0,
                    endOffset: line.length + 1,
                },
            ],
            municipalityPartCode: null,
        };
    }
    const { name } = match.groups;
    return yield getMunicipalityPartResult(name, line, founder);
});
export const getWholeMunicipality = (line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const match = wholeMunicipalityPattern.exec(line);
    if (match === null) {
        return {
            errors: [
                {
                    message: "Neplatný zápis pro přidání celé obce. Správný zápis je: území <typ> <název obce>. Např.: 'území obce Kladno' (název obce musí být v 1. pádě).",
                    startOffset: 0,
                    endOffset: line.length + 1,
                },
            ],
            municipality: null,
        };
    }
    const { type, name } = match.groups;
    return yield getMunicipalityResult(type, cleanName(name), line, founder);
});
const getMunicipalityResult = (type, name, line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const typeValue = getMunicipalityType(type);
    const { municipality, errors } = yield findMunicipalityByNameAndType(name, typeValue, founder);
    const startOffset = line.indexOf(name);
    const endOffset = startOffset + name.length + 1;
    return {
        municipality,
        errors: errors.map((error) => (Object.assign(Object.assign({}, error), { startOffset,
            endOffset }))),
    };
});
export const getMunicipalityPartResult = (name, line, founder) => __awaiter(void 0, void 0, void 0, function* () {
    const { municipalityPartCode, errors } = yield findMunicipalityPartByName(name, founder);
    const startOffset = line.indexOf(name);
    const endOffset = startOffset + name.length + 1;
    return {
        municipalityPartCode,
        errors: errors.map((error) => (Object.assign(Object.assign({}, error), { startOffset,
            endOffset }))),
    };
});
const getMunicipalityType = (type) => {
    switch (type) {
        case "městské části":
        case "městského obvodu":
            return MunicipalityType.District;
        case "obce":
        case "města":
            return MunicipalityType.City;
    }
};
const cleanName = (name) => {
    return name.trim();
};
